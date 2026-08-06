<?php

namespace App\Http\Controllers;

use App\Services\FirestoreService;
use Illuminate\Http\JsonResponse;
use Throwable;

class FirestoreHealthController extends Controller
{
    public function __invoke(FirestoreService $firestore): JsonResponse
    {
        try {
            $firestore->checkConnection();

            return response()->json([
                'status' => 'ok',
                'firestore' => 'connected',
            ]);
        } catch (Throwable $e) {
            return response()->json([
                'status' => 'error',
                'message' => $e->getMessage(),
            ], 503);
        }
    }
}
