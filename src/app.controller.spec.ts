import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('health', () => {
    it('mengembalikan status ok dalam bentuk { data }', () => {
      const body = appController.getHealth();
      expect(body.data.status).toBe('ok');
      expect(body.data.service).toBe('durent-backend');
      expect(typeof body.data.timestamp).toBe('string');
    });
  });
});
