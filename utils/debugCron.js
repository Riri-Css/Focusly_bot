// File: src/jobs/debugCron.js

const cron = require('node-cron');
const User = require('../models/user');

// Helper function for consistent UTC date format
function getTodayIsoDateUTC() {
    return new Date().toISOString().split('T')[0];
}

function startDebugJobs(bot) {
    // ⏰ Debugging job that runs every minute
    cron.schedule('* * * * *', async () => {
        try {
            // Find a specific test user
            const testUser = await User.findOne({ telegramId: 'YOUR_TELEGRAM_ID_HERE' });
            if (!testUser) {
                console.log('❌ Test user not found. Please set your Telegram ID.');
                return;
            }

            const today = getTodayIsoDateUTC();
            const lastChecklist = testUser.checklists?.[testUser.checklists.length - 1];
            const hasChecklistToday = lastChecklist && getTodayIsoDateUTC(new Date(lastChecklist.date)) === today;

            // --- ALL THE LOGS YOU NEED ---
            console.log('\n--- CRON DEBUGGING LOGS ---');
            console.log(`Time: ${new Date().toLocaleTimeString()}`);
            console.log(`Today's ISO date (UTC): ${today}`);
            console.log(`Test User ID: ${testUser.telegramId}`);
            console.log(`Has Goal:`, !!testUser.goalMemory?.text);
            console.log(`Checklists Array Length:`, testUser.checklists?.length);
            console.log(`Last Checklist Date:`, lastChecklist ? getTodayIsoDateUTC(new Date(lastChecklist.date)) : 'N/A');
            console.log(`Has Checklist for Today?`, hasChecklistToday);

            // This is the key part that checks your conditions
            if (hasChecklistToday) {
                console.log('✅ Found a checklist for today. The reminder condition would fail.');
            } else {
                console.log('❌ No checklist for today. The reminder condition would pass.');
            }
            
            console.log('-------------------------------\n');
            
        } catch (err) {
            console.error('❌ Debug cron error:', err.message);
        }
    });
}

module.exports = { startDebugJobs };