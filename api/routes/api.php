<?php

use App\Http\Controllers\AuthMeController;
use App\Http\Controllers\FamilyController;
use App\Http\Controllers\FirestoreHealthController;
use App\Http\Controllers\ProfileController;
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
});

Route::get('/user', function (Request $request) {
    return $request->user();
})->middleware('auth:sanctum');
