import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'app/mobile_app.dart';
import 'shared/services/push_notification_service.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  PlatformDispatcher.instance.onError = (error, stack) {
    if (error is MissingPluginException) {
      final msg = error.message ?? '';
      if (msg.contains('disposeAllPlayers')) {
        return true;
      }
    }
    return false;
  };
  await PushNotificationService.registerBackgroundHandler();
  runApp(const ProviderScope(child: WorkplaceMobileApp()));
}
