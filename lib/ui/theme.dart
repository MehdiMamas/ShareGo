import 'package:flutter/material.dart';

// The colors of the app icon (assets/icon.svg), which are also the colors of
// ShareGo before the Flutter rewrite.
const _background = Color(0xFF0F172A);
const _surface = Color(0xFF1E293B);
const _border = Color(0xFF334155);
const _primary = Color(0xFF3B82F6);
const _text = Color(0xFFF1F5F9);
const _textSecondary = Color(0xFF94A3B8);
const _error = Color(0xFFEF4444);

ThemeData shareGoTheme() {
  final scheme = ColorScheme.fromSeed(seedColor: _primary, brightness: Brightness.dark).copyWith(
    primary: _primary,
    onPrimary: Colors.white,
    secondary: _primary,
    onSecondary: Colors.white,
    error: _error,
    onError: Colors.white,
    surface: _background,
    onSurface: _text,
    onSurfaceVariant: _textSecondary,
    surfaceContainerLowest: _background,
    surfaceContainerLow: _surface,
    surfaceContainer: _surface,
    surfaceContainerHigh: _surface,
    surfaceContainerHighest: _border,
    outline: _border,
    outlineVariant: _border,
  );
  return ThemeData(
    colorScheme: scheme,
    useMaterial3: true,
    scaffoldBackgroundColor: _background,
    appBarTheme: const AppBarTheme(
      backgroundColor: _background,
      foregroundColor: _text,
      surfaceTintColor: Colors.transparent,
    ),
    cardTheme: const CardThemeData(
      color: _surface,
      surfaceTintColor: Colors.transparent,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.all(Radius.circular(12)),
        side: BorderSide(color: _border),
      ),
    ),
    dialogTheme: const DialogThemeData(backgroundColor: _surface, surfaceTintColor: Colors.transparent),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(foregroundColor: _text, side: const BorderSide(color: _border)),
    ),
    textButtonTheme: TextButtonThemeData(style: TextButton.styleFrom(foregroundColor: _primary)),
    inputDecorationTheme: const InputDecorationTheme(
      labelStyle: TextStyle(color: _textSecondary),
      hintStyle: TextStyle(color: _textSecondary),
      enabledBorder: UnderlineInputBorder(borderSide: BorderSide(color: _border)),
      focusedBorder: UnderlineInputBorder(borderSide: BorderSide(color: _primary, width: 2)),
    ),
    snackBarTheme: const SnackBarThemeData(
      backgroundColor: _surface,
      contentTextStyle: TextStyle(color: _text),
    ),
  );
}
