<?php

namespace App\Http\Middleware;

use App\Exceptions\FirebaseAuthenticationException;
use App\Services\FirebaseAuthService;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class VerifyFirebaseToken
{
    public function __construct(
        private readonly FirebaseAuthService $firebaseAuth,
    ) {}

    /**
     * @param  Closure(Request): Response  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $authorization = $request->header('Authorization');

        if (! is_string($authorization) || ! str_starts_with($authorization, 'Bearer ')) {
            return response()->json([
                'message' => '認証が必要です',
            ], 401);
        }

        $token = trim(substr($authorization, 7));

        if ($token === '') {
            return response()->json([
                'message' => '認証が必要です',
            ], 401);
        }

        try {
            $verifiedUser = $this->firebaseAuth->verifyIdToken($token);
        } catch (FirebaseAuthenticationException) {
            return response()->json([
                'message' => '認証が必要です',
            ], 401);
        }

        $request->attributes->set('firebase_uid', $verifiedUser->uid);
        $request->attributes->set('firebase_email', $verifiedUser->email);
        $request->attributes->set('firebase_email_verified', $verifiedUser->emailVerified);

        return $next($request);
    }
}
