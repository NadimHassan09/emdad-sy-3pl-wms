export type ClientPortalRole = 'client_admin' | 'client_staff';

export interface ClientUser {
  id: string;
  email: string | null;
  fullName: string;
  role: ClientPortalRole;
  companyId: string;
  companyName: string;
}

export interface ClientLoginPayload {
  access_token: string;
  token_type: 'Bearer';
  expires_in: number;
  user: {
    id: string;
    email: string | null;
    fullName: string | null;
    role: string;
    companyId: string;
    companyName: string | null;
  };
}
