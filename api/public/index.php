<?php

use Illuminate\Foundation\Application;
use Illuminate\Http\Request;

define('LARAVEL_START', microtime(true));

// QA / Auth Emulator runs may hit slow Firestore gRPC; avoid 30s PHP cutoffs.
if (getenv('FIREBASE_AUTH_EMULATOR_HOST')) {
    ini_set('max_execution_time', '0');
    ini_set('default_socket_timeout', '180');
}

// Determine if the application is in maintenance mode...
if (file_exists($maintenance = __DIR__.'/../storage/framework/maintenance.php')) {
    require $maintenance;
}

// Register the Composer autoloader...
require __DIR__.'/../vendor/autoload.php';

// Bootstrap Laravel and handle the request...
/** @var Application $app */
$app = require_once __DIR__.'/../bootstrap/app.php';

$app->handleRequest(Request::capture());
