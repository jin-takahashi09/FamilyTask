<?php

namespace App\Services;

use App\Data\VerifiedFirebaseUser;
use App\Exceptions\FirebaseAuthenticationException;
use Kreait\Firebase\Auth;
use Kreait\Firebase\Exception\Auth\FailedToVerifyToken;
use Kreait\Firebase\Factory;
use Throwable;

class FirebaseAuthService
{
    private ?Auth $auth = null;

    public function isConfigured(): bool
    {
        if ($this->authEmulatorHost() !== null) {
            return true;
        }

        $path = $this->credentialsPath();

        return $path !== null && is_readable($path);
    }

    public function authEmulatorHost(): ?string
    {
        $host = env('FIREBASE_AUTH_EMULATOR_HOST');

        if (! is_string($host) || $host === '') {
            return null;
        }

        return $host;
    }

    public function credentialsPath(): ?string
    {
        $path = env('GOOGLE_APPLICATION_CREDENTIALS');

        if (! is_string($path) || $path === '') {
            return null;
        }

        return $path;
    }

    public function verifyIdToken(string $idToken): VerifiedFirebaseUser
    {
        if (! $this->isConfigured()) {
            throw new FirebaseAuthenticationException('Firebase credentials are not configured.');
        }

        try {
            $verifiedToken = $this->auth()->verifyIdToken($idToken);
            $claims = $verifiedToken->claims();

            return new VerifiedFirebaseUser(
                uid: (string) $claims->get('sub'),
                email: $claims->has('email') ? (string) $claims->get('email') : null,
                emailVerified: (bool) $claims->get('email_verified', false),
            );
        } catch (FailedToVerifyToken) {
            throw new FirebaseAuthenticationException('Invalid Firebase ID token.');
        } catch (Throwable $e) {
            throw new FirebaseAuthenticationException('Failed to verify Firebase ID token.');
        }
    }

    private function auth(): Auth
    {
        if ($this->auth === null) {
            $factory = new Factory;

            if ($this->authEmulatorHost() !== null) {
                $projectId = env('FIREBASE_PROJECT_ID', 'demo-familytask');
                $factory = $factory->withProjectId(is_string($projectId) && $projectId !== '' ? $projectId : 'demo-familytask');
            } else {
                $factory = $factory->withServiceAccount($this->credentialsPath());
            }

            $this->auth = $factory->createAuth();
        }

        return $this->auth;
    }
}
