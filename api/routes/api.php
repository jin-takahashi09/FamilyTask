<?php

use App\Http\Controllers\AuthMeController;
use App\Http\Controllers\FirestoreHealthController;
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

Route::middleware('firebase.auth')->get('/auth/me', AuthMeController::class);

Route::get('/user', function (Request $request) {
    return $request->user();
})->middleware('auth:sanctum');
