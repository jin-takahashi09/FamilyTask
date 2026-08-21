<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

/*
|--------------------------------------------------------------------------
| Due-soon notifications (Phase 8-2)
|--------------------------------------------------------------------------
|
| Every 5 minutes, check for tasks whose Asia/Tokyo deadline is ~30 minutes
| away and create task.due_soon notifications. Manual run:
|   php artisan notifications:check-due
|   php artisan notifications:check-due --at="2026-08-21 17:30"
|
| Production requires cron: * * * * * php /path/to/artisan schedule:run
|
*/
Schedule::command('notifications:check-due')
    ->everyFiveMinutes()
    ->withoutOverlapping(10);
