import { cronJobs } from 'convex/server'
import { internal } from './_generated/api'

const crons = cronJobs()

// 23:00 UTC is 6 p.m. in Colombia (UTC-5, no DST): after school, with the day still open.
crons.daily('recordatorios por correo', { hourUTC: 23, minuteUTC: 0 }, internal.reminders.sendReminders)

export default crons
