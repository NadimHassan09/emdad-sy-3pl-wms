import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createReadStream } from 'node:fs';
import { google } from 'googleapis';

import { BackupConfig } from './backup-config';

export type DriveTokenResponse = {
  access_token?: string | null;
  refresh_token?: string | null;
  expiry_date?: number | null;
};

@Injectable()
export class BackupDriveService {
  private readonly logger = new Logger(BackupDriveService.name);

  constructor(private readonly backupConfig: BackupConfig) {}

  private createOAuthClient(refreshToken?: string) {
    this.assertConfigured();
    const client = new google.auth.OAuth2(
      this.backupConfig.gdriveClientId!,
      this.backupConfig.gdriveClientSecret!,
      this.backupConfig.gdriveRedirectUri!,
    );
    if (refreshToken) {
      client.setCredentials({ refresh_token: refreshToken });
    }
    return client;
  }

  async exchangeCodeForTokens(code: string): Promise<DriveTokenResponse> {
    const client = this.createOAuthClient();
    const { tokens } = await client.getToken(code);
    return tokens;
  }

  async ensureRootFolder(refreshToken: string): Promise<string> {
    const drive = google.drive({ version: 'v3', auth: this.createOAuthClient(refreshToken) });
    const folderName = this.backupConfig.gdriveRootFolderName;

    const existing = await drive.files.list({
      q: `mimeType='application/vnd.google-apps.folder' and name='${folderName.replace(/'/g, "\\'")}' and trashed=false`,
      fields: 'files(id,name)',
      pageSize: 1,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });

    const found = existing.data.files?.[0]?.id;
    if (found) return found;

    const created = await drive.files.create({
      requestBody: {
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
      },
      fields: 'id',
      supportsAllDrives: true,
    });
    if (!created.data.id) throw new Error('Failed to create Google Drive root folder.');
    return created.data.id;
  }

  async testConnection(refreshToken: string, folderId: string): Promise<{
    ok: boolean;
    folderName: string | null;
    folderId: string;
  }> {
    const drive = google.drive({ version: 'v3', auth: this.createOAuthClient(refreshToken) });
    const folder = await drive.files.get({
      fileId: folderId,
      fields: 'id,name,mimeType,trashed',
      supportsAllDrives: true,
    });

    if (folder.data.trashed) {
      throw new BadRequestException('Configured Google Drive folder is in trash.');
    }
    if (folder.data.mimeType !== 'application/vnd.google-apps.folder') {
      throw new BadRequestException('Configured Google Drive resource is not a folder.');
    }

    await drive.files.list({
      q: `'${folderId}' in parents and trashed=false`,
      pageSize: 1,
      fields: 'files(id)',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });

    return {
      ok: true,
      folderName: folder.data.name ?? null,
      folderId,
    };
  }

  async uploadEncryptedDump(input: {
    refreshToken: string;
    rootFolderId: string;
    environmentId: string;
    jobId: string;
    encFilePath: string;
    encFilename: string;
  }): Promise<string> {
    const drive = google.drive({ version: 'v3', auth: this.createOAuthClient(input.refreshToken) });
    const monthFolder = new Date().toISOString().slice(0, 7);
    const envFolderId = await this.ensureChildFolder(drive, input.rootFolderId, input.environmentId);
    const periodFolderId = await this.ensureChildFolder(drive, envFolderId, monthFolder);

    const created = await drive.files.create({
      requestBody: {
        name: input.encFilename,
        parents: [periodFolderId],
      },
      media: {
        mimeType: 'application/octet-stream',
        body: createReadStream(input.encFilePath),
      },
      fields: 'id',
      supportsAllDrives: true,
    });

    if (!created.data.id) throw new Error('Google Drive upload returned no file id.');
    this.logger.log(`Uploaded encrypted backup ${input.jobId} to Drive file ${created.data.id}`);
    return created.data.id;
  }

  private async ensureChildFolder(
    drive: ReturnType<typeof google.drive>,
    parentId: string,
    name: string,
  ): Promise<string> {
    const escaped = name.replace(/'/g, "\\'");
    const existing = await drive.files.list({
      q: `mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and name='${escaped}' and trashed=false`,
      fields: 'files(id)',
      pageSize: 1,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
    const found = existing.data.files?.[0]?.id;
    if (found) return found;

    const created = await drive.files.create({
      requestBody: {
        name,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentId],
      },
      fields: 'id',
      supportsAllDrives: true,
    });
    if (!created.data.id) throw new Error(`Failed to create Drive folder "${name}".`);
    return created.data.id;
  }

  async deleteFile(refreshToken: string, fileId: string): Promise<void> {
    const drive = google.drive({ version: 'v3', auth: this.createOAuthClient(refreshToken) });
    await drive.files.delete({
      fileId,
      supportsAllDrives: true,
    });
    this.logger.log(`Deleted Google Drive file ${fileId}`);
  }

  private assertConfigured(): void {
    if (!this.backupConfig.gdriveConfigured()) {
      throw new ServiceUnavailableException(
        'Google Drive integration is not configured (BACKUP_GDRIVE_ENABLED and OAuth env vars).',
      );
    }
  }
}
