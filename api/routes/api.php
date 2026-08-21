<?php

use App\Http\Controllers\AuthMeController;
use App\Http\Controllers\FamilyController;
use App\Http\Controllers\FirestoreHealthController;
use App\Http\Controllers\NotificationController;
use App\Http\Controllers\ProfileController;
use App\Http\Controllers\TaskController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

Route::get('/health', function () {
    return response()->json([
        'status' => 'ok',
        'service' => 'FamilyTask API',
        'timestamp' => now()->toIso8601String(),
    ]);
});

Route::get('/firestore/health', FirestoreHealthController::class);

Route::middleware('firebase.auth')->group(function () {
    Route::get('/auth/me', AuthMeController::class);
    Route::get('/profile', [ProfileController::class, 'show']);
    Route::put('/profile', [ProfileController::class, 'upsert']);
    Route::post('/profile/avatar', [ProfileController::class, 'uploadAvatar']);
    Route::delete('/profile/avatar', [ProfileController::class, 'deleteAvatar']);

    Route::get('/families', [FamilyController::class, 'index']);
    Route::post('/families', [FamilyController::class, 'store']);
    Route::post('/families/join', [FamilyController::class, 'join']);
    Route::get('/families/{familyId}', [FamilyController::class, 'show']);
    Route::get('/families/{familyId}/members', [FamilyController::class, 'members']);
    Route::post('/families/{familyId}/leave', [FamilyController::class, 'leave']);
    Route::delete('/families/{familyId}/members/{userId}', [FamilyController::class, 'removeMember']);
    Route::post('/families/{familyId}/transfer-ownership', [FamilyController::class, 'transferOwnership']);
    Route::delete('/families/{familyId}', [FamilyController::class, 'destroy']);
    Route::post('/families/{familyId}/invite-code/regenerate', [FamilyController::class, 'regenerateInviteCode']);

    Route::get('/families/{familyId}/tasks', [TaskController::class, 'index']);
    Route::post('/families/{familyId}/tasks', [TaskController::class, 'store']);
    Route::get('/families/{familyId}/tasks/{taskId}', [TaskController::class, 'show']);
    Route::put('/families/{familyId}/tasks/{taskId}', [TaskController::class, 'update']);
    Route::patch('/families/{familyId}/tasks/{taskId}/complete', [TaskController::class, 'complete']);
    Route::delete('/families/{familyId}/tasks/{taskId}', [TaskController::class, 'destroy']);
    Route::delete('/families/{familyId}/recurrences/{recurrenceGroupId}', [TaskController::class, 'destroyRecurrence']);

    Route::get('/notifications', [NotificationController::class, 'index']);
    Route::patch('/notifications/{id}/read', [NotificationController::class, 'markRead']);
    Route::post('/notifications/read-all', [NotificationController::class, 'markAllRead']);
});

Route::get('/user', function (Request $request) {
    return $request->user();
})->middleware('auth:sanctum');
