package com.pacr.app.ui.screen

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.health.connect.client.PermissionController
import androidx.hilt.navigation.compose.hiltViewModel
import com.pacr.app.data.health.HealthConnectManager
import com.pacr.app.ui.health.HealthPermissionViewModel

@Composable
fun HealthPermissionScreen(
    onPermissionsGranted: () -> Unit,
    viewModel: HealthPermissionViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsState()

    val permissionLauncher = rememberLauncherForActivityResult(
        contract = PermissionController.createRequestPermissionResultContract(),
    ) { granted ->
        viewModel.onPermissionsResult(granted)
        if (granted.containsAll(HealthConnectManager.PERMISSIONS)) {
            onPermissionsGranted()
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(32.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(
            text = "Health Data Access",
            style = MaterialTheme.typography.headlineMedium,
            textAlign = TextAlign.Center,
        )
        Spacer(Modifier.height(16.dp))
        Text(
            text = "Pacr reads your heart rate, HRV, sleep, and activity data from Health Connect to personalise your training plan and readiness score.",
            style = MaterialTheme.typography.bodyLarge,
            textAlign = TextAlign.Center,
        )

        if (state.isDegraded && state.missingPermissions.isNotEmpty()) {
            Spacer(Modifier.height(16.dp))
            Text(
                text = "Some metrics are unavailable — readiness score may be less accurate.",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.error,
                textAlign = TextAlign.Center,
            )
        }

        Spacer(Modifier.height(32.dp))

        Button(
            onClick = { permissionLauncher.launch(HealthConnectManager.PERMISSIONS) },
        ) {
            Text(if (state.isDegraded) "Update Permissions" else "Grant Access")
        }

        if (state.isDegraded) {
            Spacer(Modifier.height(12.dp))
            Button(onClick = onPermissionsGranted) {
                Text("Continue with Limited Access")
            }
        }
    }
}
