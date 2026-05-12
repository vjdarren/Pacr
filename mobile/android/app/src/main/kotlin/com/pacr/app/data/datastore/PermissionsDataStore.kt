package com.pacr.app.data.datastore

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.longPreferencesKey
import androidx.datastore.preferences.core.stringSetPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import javax.inject.Inject
import javax.inject.Singleton

private val Context.dataStore: DataStore<Preferences> by preferencesDataStore(name = "permissions")

@Singleton
class PermissionsDataStore @Inject constructor(
    @ApplicationContext private val context: Context,
) {
    private val grantedPermissionsKey = stringSetPreferencesKey("granted_permissions")
    private val lastCheckedKey = longPreferencesKey("last_permission_check_ms")

    val grantedPermissions: Flow<Set<String>> = context.dataStore.data
        .map { it[grantedPermissionsKey] ?: emptySet() }

    val lastCheckedMs: Flow<Long> = context.dataStore.data
        .map { it[lastCheckedKey] ?: 0L }

    suspend fun saveGrantedPermissions(permissions: Set<String>) {
        context.dataStore.edit { prefs ->
            prefs[grantedPermissionsKey] = permissions
            prefs[lastCheckedKey] = System.currentTimeMillis()
        }
    }
}
