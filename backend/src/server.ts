import app from './app';
import { env } from './config/env';
import { startRatingReminderScheduler } from './services/ratingReminder.service';
import { startSlaScheduler } from './services/slaScheduler.service';
import { startAssignmentSlaScheduler } from './services/assignerSla.service';
import { startAttendanceScheduler } from './jobs/attendanceScheduler';

const startServer = () => {
  try {
    app.listen(env.PORT, () => {
      console.log(`🚀 Server is running on port ${env.PORT} in ${env.NODE_ENV} mode`);
      // Start background schedulers
      startRatingReminderScheduler();
      startSlaScheduler();
      startAssignmentSlaScheduler();
      startAttendanceScheduler();
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
