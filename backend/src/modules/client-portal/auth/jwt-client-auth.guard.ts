import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtClientAuthGuard extends AuthGuard('jwt-client') {}
