<?php

namespace App\Http\Middleware;

use App\Exceptions\FirebaseAuthenticationException;
use App\Services\FirebaseAuthService;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
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
            if (app()->environment('local')) {
                Log::warning('Firebase auth middleware rejected request', [
                    'reason' => 'missing_or_invalid_authorization_header',
                    'hasAuthorizationHeader' => is_string($authorization),
                    'startsWithBearer' => is_string($authorization) && str_starts_with($authorization, 'Bearer '),
                    'path' => $request->path(),
                ]);
            }

            return response()->json([
                'message' => '認証が必要です',
            ], 401);
        }

        $token = trim(substr($authorization, 7));

        if ($token === '') {
            if (app()->environment('local')) {
                Log::warning('Firebase auth middleware rejected request', [
                    'reason' => 'empty_bearer_token',
                    'path' => $request->path(),
                ]);
            }

            return response()->json([
                'message' => '認証が必要です',
            ], 401);
        }

        // Decode JWT payload claims without verification for safe diagnostics only.
        $unsafeClaims = $this->peekJwtClaims($token);

        try {
            $verifiedUser = $this->firebaseAuth->verifyIdToken($token);
        } catch (FirebaseAuthenticationException $e) {
            if (app()->environment('local')) {
                Log::warning('Firebase auth middleware rejected request', [
                    'reason' => 'verify_id_token_failed',
                    'path' => $request->path(),
                    'exceptionMessage' => $e->getMessage(),
                    'tokenAud' => $unsafeClaims['aud'] ?? null,
                    'tokenIss' => $unsafeClaims['iss'] ?? null,
                    'tokenEmailVerified' => $unsafeClaims['email_verified'] ?? null,
                    'tokenIat' => $unsafeClaims['iat'] ?? null,
                    'tokenExp' => $unsafeClaims['exp'] ?? null,
                    'tokenAuthTime' => $unsafeClaims['auth_time'] ?? null,
                    'phpTimeUnix' => time(),
                    'tokenSecondsToExp' => isset($unsafeClaims['exp']) ? ((int) $unsafeClaims['exp'] - time()) : null,
                    'tokenSecondsSinceIat' => isset($unsafeClaims['iat']) ? (time() - (int) $unsafeClaims['iat']) : null,
                ]);
            }

            return response()->json([
                'message' => '認証が必要です',
            ], 401);
        }

        $request->attributes->set('firebase_uid', $verifiedUser->uid);
        $request->attributes->set('firebase_email', $verifiedUser->email);
        $request->attributes->set('firebase_email_verified', $verifiedUser->emailVerified);

        $authUser = (object) ['id' => $verifiedUser->uid];
        $request->setUserResolver(fn () => $authUser);

        return $next($request);
    }

    /**
     * Unverified JWT payload peek for local diagnostics only.
     *
     * @return array<string, mixed>
     */
    private function peekJwtClaims(string $jwt): array
    {
        $parts = explode('.', $jwt);
        if (count($parts) < 2) {
            return [];
        }

        $payload = $parts[1];
        $remainder = strlen($payload) % 4;
        if ($remainder > 0) {
            $payload .= str_repeat('=', 4 - $remainder);
        }

        $decoded = base64_decode(strtr($payload, '-_', '+/'), true);
        if (! is_string($decoded) || $decoded === '') {
            return [];
        }

        $json = json_decode($decoded, true);

        return is_array($json) ? $json : [];
    }
}
