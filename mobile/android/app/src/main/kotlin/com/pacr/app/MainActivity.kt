package com.pacr.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.navigation.compose.rememberNavController
import com.pacr.app.data.datastore.OnboardingDataStore
import com.pacr.app.data.datastore.TokenDataStore
import com.pacr.app.data.health.HealthConnectManager
import com.pacr.app.data.sync.HistoricalSyncManager
import com.pacr.app.ui.health.HealthPermissionViewModel
import com.pacr.app.ui.navigation.PacrNavGraph
import com.pacr.app.ui.theme.PacrColors
import com.pacr.app.ui.theme.PacrTheme
import dagger.hilt.android.AndroidEntryPoint
import androidx.activity.viewModels
import androidx.compose.foundation.layout.Box
import javax.inject.Inject

@AndroidEntryPoint
class MainActivity : ComponentActivity() {

    @Inject lateinit var healthConnectManager: HealthConnectManager
    @Inject lateinit var onboardingDataStore: OnboardingDataStore
    @Inject lateinit var historicalSyncManager: HistoricalSyncManager
    @Inject lateinit var tokenDataStore: TokenDataStore

    private val permissionViewModel: HealthPermissionViewModel by viewModels()

    private var sdkAvailability by mutableStateOf<HealthConnectManager.SdkAvailability?>(null)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        checkSdkAndPermissions()

        setContent {
            PacrTheme {
                Box(
                    Modifier
                        .fillMaxSize()
                        .background(PacrColors.Bg)
                ) {
                    val navController = rememberNavController()
                    PacrNavGraph(
                        navController = navController,
                        sdkAvailability = sdkAvailability,
                        onboardingDataStore = onboardingDataStore,
                        historicalSyncManager = historicalSyncManager,
                        tokenDataStore = tokenDataStore,
                    )
                }
            }
        }
    }

    override fun onResume() {
        super.onResume()
        // Re-check SDK status and permissions every resume — the user may have
        // installed Health Connect or revoked permissions while the app was backgrounded.
        checkSdkAndPermissions()
    }

    private fun checkSdkAndPermissions() {
        val availability = healthConnectManager.checkAvailability()
        sdkAvailability = availability

        when (availability) {
            HealthConnectManager.SdkAvailability.NOT_INSTALLED ->
                startActivity(healthConnectManager.getInstallIntent())
            HealthConnectManager.SdkAvailability.AVAILABLE ->
                permissionViewModel.refreshPermissions()
            else -> Unit
        }
    }
}
