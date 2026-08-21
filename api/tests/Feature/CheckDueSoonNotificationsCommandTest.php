<?php

namespace Tests\Feature;

use App\Services\DueSoonNotificationChecker;
use Tests\TestCase;

class CheckDueSoonNotificationsCommandTest extends TestCase
{
    public function test_command_is_registered_and_runs_with_at_option(): void
    {
        $this->mock(DueSoonNotificationChecker::class, function ($mock) {
            $mock->shouldReceive('run')
                ->once()
                ->andReturn([
                    'now' => '2026-08-21T17:30:00+09:00',
                    'dateKeys' => ['2026-08-21'],
                    'checked' => 0,
                    'created' => 0,
                    'skipped' => 0,
                ]);
        });

        $this->artisan('notifications:check-due', [
            '--at' => '2026-08-21 17:30',
        ])->assertSuccessful();
    }

    public function test_command_rejects_invalid_at(): void
    {
        $this->artisan('notifications:check-due', [
            '--at' => 'not-a-date',
        ])->assertFailed();
    }
}
