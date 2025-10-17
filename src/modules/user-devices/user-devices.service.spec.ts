import { Test, TestingModule } from '@nestjs/testing';
import { UserDevicesService } from './user-devices.service';

describe('UserDevicesService', () => {
  let service: UserDevicesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [UserDevicesService],
    }).compile();

    service = module.get<UserDevicesService>(UserDevicesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
