import { Test, TestingModule } from '@nestjs/testing';
import { UserDevicesController } from './user-devices.controller';
import { UserDevicesService } from './user-devices.service';

describe('UserDevicesController', () => {
  let controller: UserDevicesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserDevicesController],
      providers: [UserDevicesService],
    }).compile();

    controller = module.get<UserDevicesController>(UserDevicesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
