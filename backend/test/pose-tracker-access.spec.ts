import { describe,it,expect } from 'vitest';
import { Test } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import request from 'supertest';
import { getModelToken } from '@nestjs/mongoose';
import { AuthRateLimit } from '../src/auth/auth-rate-limit.schema.js';
import { PoseTrackerRateLimitGuard } from '../src/pose-tracker/pose-tracker-rate-limit.guard.js';
import { JwtAuthGuard } from '../src/auth/jwt-auth.guard.js';
import { RolesGuard } from '../src/auth/roles.guard.js';
import { PoseTrackerAdminController, PoseTrackerController, PoseTrackerService } from '../src/pose-tracker/pose-tracker.module.js';
describe('PoseTracker access control',()=>{
  it('shares launch quota across normal and admin routes and marks both responses no-store',async()=>{
    const buckets=new Map<string,number>();
    const model={findOneAndUpdate:async(filter:{_id:string})=>{const hits=(buckets.get(filter._id)??0)+1;buckets.set(filter._id,hits);return {hits};}};
    const module=await Test.createTestingModule({controllers:[PoseTrackerController,PoseTrackerAdminController],providers:[RolesGuard,PoseTrackerRateLimitGuard,{provide:getModelToken(AuthRateLimit.name),useValue:model},{provide:PoseTrackerService,useValue:{launch:()=>({token:'test-only'})}}]}).overrideGuard(JwtAuthGuard).useValue({canActivate(context:any){context.switchToHttp().getRequest().user={userId:'admin',role:'admin'};return true;}}).compile();
    const app=module.createNestApplication();await app.init();
    try {for(let i=0;i<10;i++){const path=i%2?'/admin/pose-tracker/exercises/id/test':'/pose-tracker/exercises/id/launch';const result=await request(app.getHttpServer()).post(path).expect(201);expect(result.headers['cache-control']).toBe('private, no-store');}const rejected=await request(app.getHttpServer()).post('/admin/pose-tracker/exercises/id/test').expect(429);expect(rejected.headers['retry-after']).toBeDefined();}finally{await app.close();}
  });
  it('rejects anonymous launches and ordinary-user admin access',async()=>{
    const module=await Test.createTestingModule({controllers:[PoseTrackerController,PoseTrackerAdminController],providers:[RolesGuard,PoseTrackerRateLimitGuard,{provide:getModelToken(AuthRateLimit.name),useValue:{findOneAndUpdate:async()=>({hits:1})}},{provide:PoseTrackerService,useValue:{launch:()=>({token:'test'}),audit:()=>({records:[]})}}]}).overrideGuard(JwtAuthGuard).useValue({canActivate(context:any){const req=context.switchToHttp().getRequest();if(!req.headers.authorization)throw new UnauthorizedException();req.user={userId:'user',role:req.headers.authorization==='admin'?'admin':'user'};return true;}}).compile();
    const app=module.createNestApplication();await app.init();
    try{await request(app.getHttpServer()).post('/pose-tracker/exercises/id/launch').expect(401);await request(app.getHttpServer()).get('/admin/pose-tracker/coverage').set('Authorization','user').expect(403);const result=await request(app.getHttpServer()).get('/admin/pose-tracker/coverage').set('Authorization','admin').expect(200);expect(result.body.records).toEqual([]);const launch=await request(app.getHttpServer()).post('/pose-tracker/exercises/id/launch').set('Authorization','user').expect(201);expect(launch.headers['cache-control']).toBe('private, no-store');}finally{await app.close();}
  });
});
