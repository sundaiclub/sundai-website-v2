import { sendNotification } from '../../src/lib/notifications';

// Mock prisma
jest.mock('../../src/lib/prisma', () => ({
  __esModule: true,
  default: {
    notification: {
      create: jest.fn(),
    },
    pushSubscription: {
      findMany: jest.fn(),
    },
  },
}));

// Mock web-push
jest.mock('web-push', () => ({
  sendNotification: jest.fn(),
}), { virtual: true });

describe('Notifications', () => {
  const mockPrisma = {
    notification: {
      create: jest.fn(),
    },
    pushSubscription: {
      findMany: jest.fn(),
    },
  };
  const mockWebpush = {
    sendNotification: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset the mock implementation
    require('../../src/lib/prisma').default = mockPrisma;
    require('web-push').sendNotification = mockWebpush.sendNotification;
  });

  describe('sendNotification', () => {
    it('should create notification and send to all subscriptions', async () => {
      const mockNotification = {
        id: 'notification-123',
        type: 'NEW_PROJECT',
        title: 'Test Notification',
        body: 'Test body',
        hackerId: 'hacker-123',
      };

      const mockSubscriptions = [
        {
          id: 'sub-1',
          endpoint: 'https://fcm.googleapis.com/fcm/send/endpoint1',
          p256dh: 'p256dh-key-1',
          auth: 'auth-key-1',
          hackerId: 'hacker-123',
          notifyNewProjects: true,
        },
        {
          id: 'sub-2',
          endpoint: 'https://fcm.googleapis.com/fcm/send/endpoint2',
          p256dh: 'p256dh-key-2',
          auth: 'auth-key-2',
          hackerId: 'hacker-123',
          notifyNewProjects: true,
        },
      ];

      mockPrisma.notification.create.mockResolvedValue(mockNotification);
      mockPrisma.pushSubscription.findMany.mockResolvedValue(mockSubscriptions);
      mockWebpush.sendNotification.mockResolvedValue(undefined);

      await sendNotification(
        'hacker-123',
        'NEW_PROJECT',
        'Test Notification',
        'Test body',
        'icon.png',
        { projectId: 'project-123' }
      );

      expect(mockPrisma.notification.create).toHaveBeenCalledWith({
        data: {
          type: 'NEW_PROJECT',
          title: 'Test Notification',
          body: 'Test body',
          icon: 'icon.png',
          data: { projectId: 'project-123' },
          hackerId: 'hacker-123',
        },
      });

      expect(mockPrisma.pushSubscription.findMany).toHaveBeenCalledWith({
        where: {
          hackerId: 'hacker-123',
          notifyNewProjects: true,
        },
      });

      expect(mockWebpush.sendNotification).toHaveBeenCalledTimes(2);
      expect(mockWebpush.sendNotification).toHaveBeenCalledWith(
        {
          endpoint: 'https://fcm.googleapis.com/fcm/send/endpoint1',
          keys: {
            p256dh: 'p256dh-key-1',
            auth: 'auth-key-1',
          },
        },
        JSON.stringify({
          title: 'Test Notification',
          body: 'Test body',
          icon: 'icon.png',
          data: {
            projectId: 'project-123',
            notificationId: 'notification-123',
          },
        })
      );
    });

    it('should filter subscriptions based on notification type', async () => {
      const mockNotification = {
        id: 'notification-123',
        type: 'PROJECT_UPDATE',
        title: 'Project Updated',
        body: 'Your project has been updated',
        hackerId: 'hacker-123',
      };

      mockPrisma.notification.create.mockResolvedValue(mockNotification);
      mockPrisma.pushSubscription.findMany.mockResolvedValue([]);
      mockWebpush.sendNotification.mockResolvedValue(undefined);

      await sendNotification(
        'hacker-123',
        'PROJECT_UPDATE',
        'Project Updated',
        'Your project has been updated'
      );

      expect(mockPrisma.pushSubscription.findMany).toHaveBeenCalledWith({
        where: {
          hackerId: 'hacker-123',
          notifyProjectUpdates: true,
        },
      });
    });

    it('should filter subscriptions for NEW_LIKE notifications', async () => {
      const mockNotification = {
        id: 'notification-123',
        type: 'NEW_LIKE',
        title: 'New Like',
        body: 'Someone liked your project',
        hackerId: 'hacker-123',
      };

      mockPrisma.notification.create.mockResolvedValue(mockNotification);
      mockPrisma.pushSubscription.findMany.mockResolvedValue([]);
      mockWebpush.sendNotification.mockResolvedValue(undefined);

      await sendNotification(
        'hacker-123',
        'NEW_LIKE',
        'New Like',
        'Someone liked your project'
      );

      expect(mockPrisma.pushSubscription.findMany).toHaveBeenCalledWith({
        where: {
          hackerId: 'hacker-123',
          notifyLikes: true,
        },
      });
    });

    it('should filter subscriptions for NEW_MEMBER notifications', async () => {
      const mockNotification = {
        id: 'notification-123',
        type: 'NEW_MEMBER',
        title: 'New Member',
        body: 'Someone joined your project',
        hackerId: 'hacker-123',
      };

      mockPrisma.notification.create.mockResolvedValue(mockNotification);
      mockPrisma.pushSubscription.findMany.mockResolvedValue([]);
      mockWebpush.sendNotification.mockResolvedValue(undefined);

      await sendNotification(
        'hacker-123',
        'NEW_MEMBER',
        'New Member',
        'Someone joined your project'
      );

      expect(mockPrisma.pushSubscription.findMany).toHaveBeenCalledWith({
        where: {
          hackerId: 'hacker-123',
          notifyNewMembers: true,
        },
      });
    });

    it('should handle errors gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      mockPrisma.notification.create.mockRejectedValue(new Error('Database error'));

      await sendNotification(
        'hacker-123',
        'NEW_PROJECT',
        'Test Notification',
        'Test body'
      );

      expect(consoleSpy).toHaveBeenCalledWith('Error sending notification:', expect.any(Error));
      
      consoleSpy.mockRestore();
    });

    it('should handle webpush errors gracefully', async () => {
      const mockNotification = {
        id: 'notification-123',
        type: 'NEW_PROJECT',
        title: 'Test Notification',
        body: 'Test body',
        hackerId: 'hacker-123',
      };

      const mockSubscriptions = [
        {
          id: 'sub-1',
          endpoint: 'https://fcm.googleapis.com/fcm/send/endpoint1',
          p256dh: 'p256dh-key-1',
          auth: 'auth-key-1',
          hackerId: 'hacker-123',
          notifyNewProjects: true,
        },
      ];

      mockPrisma.notification.create.mockResolvedValue(mockNotification);
      mockPrisma.pushSubscription.findMany.mockResolvedValue(mockSubscriptions);
      mockWebpush.sendNotification.mockRejectedValue(new Error('Webpush error'));

      // Should not throw
      await expect(sendNotification(
        'hacker-123',
        'NEW_PROJECT',
        'Test Notification',
        'Test body'
      )).resolves.not.toThrow();

      expect(mockWebpush.sendNotification).toHaveBeenCalled();
    });

    it('should work without optional parameters', async () => {
      const mockNotification = {
        id: 'notification-123',
        type: 'NEW_PROJECT',
        title: 'Test Notification',
        body: 'Test body',
        hackerId: 'hacker-123',
      };

      mockPrisma.notification.create.mockResolvedValue(mockNotification);
      mockPrisma.pushSubscription.findMany.mockResolvedValue([]);
      mockWebpush.sendNotification.mockResolvedValue(undefined);

      await sendNotification(
        'hacker-123',
        'NEW_PROJECT',
        'Test Notification',
        'Test body'
      );

      expect(mockPrisma.notification.create).toHaveBeenCalledWith({
        data: {
          type: 'NEW_PROJECT',
          title: 'Test Notification',
          body: 'Test body',
          icon: undefined,
          data: undefined,
          hackerId: 'hacker-123',
        },
      });
    });
  });
});
