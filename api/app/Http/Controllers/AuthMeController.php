<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AuthMeController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        return response()->json([
            'uid' => $request->attributes->get('firebase_uid'),
            'email' => $request->attributes->get('firebase_email'),
            'emailVerified' => (bool) $request->attributes->get('firebase_email_verified'),
        ]);
    }
}
