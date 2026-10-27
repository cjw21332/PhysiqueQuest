import { AuthController } from '../src/auth/auth.controller.js';
import { RegisterDto } from '../src/auth/dto/auth.dto.js';
import { validate } from 'class-validator';

describe('registration verification', () => {
  it('returns clear guidance when verification details are missing', async () => {
    const dto = Object.assign(new RegisterDto(), { email: 'test@example.com', name: 'Test', password: 'Password1' });
    const errors = await validate(dto);
    expect(errors.find(error => error.property === 'requestId')?.constraints).toEqual({ matches: 'Your verification request is invalid or has expired. Please request a new code.' });
    expect(errors.find(error => error.property === 'code')?.constraints).toEqual({ matches: 'Enter the 6-digit verification code sent to your email.' });
  });
  it('does not create an account or session when the code is rejected', async () => {
    const register = vi.fn();
    const issue = vi.fn();
    const consumeRegistration = vi.fn().mockRejectedValue(new Error('invalid code'));
    const controller = new AuthController({ register } as any, {} as any, { issue } as any, { consumeRegistration } as any);
    const req = { is: () => true, get: () => 'http://localhost:3000' } as any;
    const dto = { email: 'test@example.invalid', name: 'Test', password: 'Password1', requestId: 'a'.repeat(64), code: '123456' };
    await expect(controller.sessionRegister(dto, req, {} as any)).rejects.toThrow('invalid code');
    expect(register).not.toHaveBeenCalled();
    expect(issue).not.toHaveBeenCalled();
  });
});
