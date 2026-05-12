package com.pacr.app.ui.health

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.pacr.app.data.datastore.PermissionsDataStore
import com.pacr.app.data.health.HealthConnectManager
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

data class PermissionUiState(
    val grantedPermissions: Set<String> = emptySet(),
    val missingPermissions: Set<String> = emptySet(),
    val isDegraded: Boolean = false,
)

@HiltViewModel
class HealthPermissionViewModel @Inject constructor(
    private val manager: HealthConnectManager,
    private val permissionsDataStore: PermissionsDataStore,
) : ViewModel() {

    private val _state = MutableStateFlow(PermissionUiState())
    val state: StateFlow<PermissionUiState> = _state.asStateFlow()

    fun refreshPermissions() {
        viewModelScope.launch {
            val granted = manager.getGrantedPermissions()
            permissionsDataStore.saveGrantedPermissions(granted)

            val missing = HealthConnectManager.PERMISSIONS - granted
            _state.update {
                PermissionUiState(
                    grantedPermissions = granted,
                    missingPermissions = missing,
                    isDegraded = missing.isNotEmpty(),
                )
            }
        }
    }

    fun onPermissionsResult(granted: Set<String>) {
        viewModelScope.launch {
            permissionsDataStore.saveGrantedPermissions(granted)
            val missing = HealthConnectManager.PERMISSIONS - granted
            _state.update {
                PermissionUiState(
                    grantedPermissions = granted,
                    missingPermissions = missing,
                    isDegraded = missing.isNotEmpty(),
                )
            }
        }
    }
}
