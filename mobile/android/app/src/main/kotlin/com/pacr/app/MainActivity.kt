package com.pacr.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.viewModels
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import com.pacr.app.data.health.HealthConnectManager
import com.pacr.app.ui.health.HealthPermissionViewModel
import com.pacr.app.ui.screen.HealthPermissionScreen
import com.pacr.app.ui.screen.UnsupportedScreen
import com.pacr.app.ui.theme.PacrTheme
import dagger.hilt.android.AndroidEntryPoint
import javax.inject.Inject

@AndroidEntryPoint
class MainActivity : ComponentActivity() {

    @Inject
    lateinit var healthConnectManager: HealthConnectManager

    private val permissionViewModel: HealthPermissionViewModel by viewModels()

    private var sdkAvailability by mutableStateOf<HealthConnectManager.SdkAvailability?>(null)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        checkSdkAvailability()
        setContent {
            PacrTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background,
                ) {
                    when (sdkAvailability) {
                        HealthConnectManager.SdkAvailability.UNAVAILABLE -> UnsupportedScreen()
                        HealthConnectManager.SdkAvailability.NOT_INSTALLED -> {
                            // Prompt install — in production this would be a dedicated screen
                            UnsupportedScreen()
                        }
                        HealthConnectManager.SdkAvailability.AVAILABLE -> {
                            HealthPermissionScreen(
                                onPermissionsGranted = { /* navigate to main app */ },
                            )
                        }
                        null -> { /* splash / loading state */ }
                    }
                }
            }
        }
    }

    override fun onResume() {
        super.onResume()
        // Re-check both SDK status and permissions every time the user returns —
        // they may have revoked permissions or installed Health Connect in the background.
        checkSdkAvailability()
        if (sdkAvailability == HealthConnectManager.SdkAvailability.AVAILABLE) {
            permissionViewModel.refreshPermissions()
        }
    }

    private fun checkSdkAvailability() {
        val availability = healthConnectManager.checkAvailability()
        sdkAvailability = availability

        if (availability == HealthConnectManager.SdkAvailability.NOT_INSTALLED) {
            startActivity(healthConnectManager.getInstallIntent())
        }
    }
}
