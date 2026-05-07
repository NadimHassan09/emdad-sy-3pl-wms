import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';

import { AuthPrincipal } from '../../common/auth/current-user.types';
import { WarehouseTasksService } from './warehouse-tasks.service';

/** Part IV — denies start/complete/progress/lease HTTP entry when DAG frontier or skills disagree (service still re-validates under lock). */
@Injectable()
export class WorkflowExecutionGateGuard implements CanActivate {
  constructor(private readonly tasks: WarehouseTasksService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<{ params?: { id?: string }; user?: AuthPrincipal }>();
    const taskId = req.params?.id?.trim();
    const user = req.user;
    if (!taskId || user == null) return true;
    await this.tasks.ensureRunnableForExecutionGate(taskId, user);
    return true;
  }
}
