import { Controller, Get } from '@nestjs/common';
    import { Public } from '@nestjs/authentication';

    @Controller('health')
    export class HealthController {
      @Public()
      @Get()
      check() {
        return { status: 'ok' };
      }
    }