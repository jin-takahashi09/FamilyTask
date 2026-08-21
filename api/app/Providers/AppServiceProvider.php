<?php

namespace App\Providers;

use App\Services\FamilySyncBroadcaster;
use App\Services\FirebaseAuthService;
use App\Services\FirebaseStorageService;
use App\Services\FirestoreService;
use App\Services\NotificationBroadcaster;
use App\Services\NotificationService;
use App\Services\ProfilePresenter;
use App\Services\UserProfileService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Broadcast;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        $this->app->singleton(FirestoreService::class);
        $this->app->singleton(FirebaseAuthService::class);
        $this->app->singleton(FirebaseStorageService::class);
        $this->app->singleton(ProfilePresenter::class);
        $this->app->singleton(UserProfileService::class);
        $this->app->singleton(FamilySyncBroadcaster::class);
        $this->app->singleton(NotificationBroadcaster::class);
        $this->app->singleton(NotificationService::class);
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        Broadcast::resolveAuthenticatedUserUsing(
            function (Request $request): ?object {
                $uid = $request->attributes->get('firebase_uid');

                if (! is_string($uid) || $uid === '') {
                    return null;
                }

                return (object) ['id' => $uid];
            },
        );

        Broadcast::routes([
            'prefix' => 'api',
            'middleware' => ['firebase.auth'],
        ]);
    }
}
