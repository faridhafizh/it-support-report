package com.itsupport.app.data.network

import android.content.Context
import android.content.SharedPreferences

class SessionManager(context: Context) {
    private val prefs: SharedPreferences =
        context.getSharedPreferences("it_support_session", Context.MODE_PRIVATE)

    companion object {
        private const val KEY_SERVER_URL = "server_url"
        private const val KEY_AUTH_TOKEN = "auth_token"
        private const val KEY_USERNAME = "username"
        private const val KEY_NAME = "name"
        private const val KEY_ROLE = "role"
        private const val KEY_IS_ADMIN = "is_admin"

        const val DEFAULT_SERVER_URL = "http://10.0.2.2:3000" // Default for Android Emulator to host localhost
    }

    fun saveServerUrl(url: String) {
        var cleanUrl = url.trim()
        if (!cleanUrl.startsWith("http://") && !cleanUrl.startsWith("https://")) {
            cleanUrl = "http://$cleanUrl"
        }
        if (cleanUrl.endsWith("/")) {
            cleanUrl = cleanUrl.substring(0, cleanUrl.length - 1)
        }
        prefs.edit().putString(KEY_SERVER_URL, cleanUrl).apply()
    }

    fun getServerUrl(): String {
        return prefs.getString(KEY_SERVER_URL, DEFAULT_SERVER_URL) ?: DEFAULT_SERVER_URL
    }

    fun saveSession(token: String, username: String, name: String, role: String, isAdmin: Boolean) {
        prefs.edit()
            .putString(KEY_AUTH_TOKEN, token)
            .putString(KEY_USERNAME, username)
            .putString(KEY_NAME, name)
            .putString(KEY_ROLE, role)
            .putBoolean(KEY_IS_ADMIN, isAdmin)
            .apply()
    }

    fun getToken(): String? = prefs.getString(KEY_AUTH_TOKEN, null)
    fun getUsername(): String? = prefs.getString(KEY_USERNAME, "")
    fun getName(): String? = prefs.getString(KEY_NAME, "")
    fun getRole(): String? = prefs.getString(KEY_ROLE, "")
    fun isAdmin(): Boolean = prefs.getBoolean(KEY_IS_ADMIN, false)

    fun isLoggedIn(): Boolean = !getToken().isNullOrEmpty()

    fun clearSession() {
        prefs.edit()
            .remove(KEY_AUTH_TOKEN)
            .remove(KEY_USERNAME)
            .remove(KEY_NAME)
            .remove(KEY_ROLE)
            .remove(KEY_IS_ADMIN)
            .apply()
    }
}
