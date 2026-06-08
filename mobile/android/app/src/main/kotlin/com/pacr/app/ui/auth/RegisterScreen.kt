package com.pacr.app.ui.auth

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusDirection
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.pacr.app.ui.components.PacrCTA
import com.pacr.app.ui.theme.PacrColors

@Composable
fun RegisterScreen(
    onSuccess: () -> Unit,
    onBack: () -> Unit,
    viewModel: AuthViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsState()
    var name by remember { mutableStateOf("") }
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    val focusManager = LocalFocusManager.current

    LaunchedEffect(viewModel) {
        viewModel.navEvents.collect { event ->
            if (event is AuthNavEvent.NavigateToOnboarding) onSuccess()
        }
    }

    Column(
        Modifier
            .fillMaxSize()
            .background(PacrColors.Bg)
            .statusBarsPadding()
            .navigationBarsPadding()
            .imePadding()
            .padding(horizontal = 24.dp),
        verticalArrangement = Arrangement.SpaceBetween,
    ) {
        Column {
            Spacer(Modifier.height(8.dp))

            IconButton(onClick = onBack) {
                Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back", tint = PacrColors.InkSoft)
            }

            Spacer(Modifier.height(16.dp))

            Text(
                "Create account",
                fontSize = 26.sp,
                fontWeight = FontWeight.Bold,
                color = PacrColors.Ink,
            )
            Text(
                "Get your personalised training plan",
                fontSize = 14.sp,
                color = PacrColors.InkMute,
                modifier = Modifier.padding(top = 4.dp),
            )

            Spacer(Modifier.height(28.dp))

            val fieldColors = OutlinedTextFieldDefaults.colors(
                focusedBorderColor = PacrColors.Coral,
                unfocusedBorderColor = PacrColors.HairlineStrong,
                focusedTextColor = PacrColors.Ink,
                unfocusedTextColor = PacrColors.Ink,
                cursorColor = PacrColors.Coral,
                focusedLabelColor = PacrColors.Coral,
                unfocusedLabelColor = PacrColors.InkMute,
            )

            OutlinedTextField(
                value = name,
                onValueChange = { name = it; viewModel.clearError() },
                label = { Text("Full name") },
                singleLine = true,
                keyboardOptions = KeyboardOptions(imeAction = ImeAction.Next),
                keyboardActions = KeyboardActions(
                    onNext = { focusManager.moveFocus(FocusDirection.Down) }
                ),
                colors = fieldColors,
                modifier = Modifier.fillMaxWidth(),
            )

            Spacer(Modifier.height(12.dp))

            OutlinedTextField(
                value = email,
                onValueChange = { email = it; viewModel.clearError() },
                label = { Text("Email") },
                singleLine = true,
                keyboardOptions = KeyboardOptions(
                    keyboardType = KeyboardType.Email,
                    imeAction = ImeAction.Next,
                ),
                keyboardActions = KeyboardActions(
                    onNext = { focusManager.moveFocus(FocusDirection.Down) }
                ),
                colors = fieldColors,
                modifier = Modifier.fillMaxWidth(),
            )

            Spacer(Modifier.height(12.dp))

            OutlinedTextField(
                value = password,
                onValueChange = { password = it; viewModel.clearError() },
                label = { Text("Password") },
                singleLine = true,
                visualTransformation = PasswordVisualTransformation(),
                keyboardOptions = KeyboardOptions(
                    keyboardType = KeyboardType.Password,
                    imeAction = ImeAction.Done,
                ),
                keyboardActions = KeyboardActions(
                    onDone = {
                        focusManager.clearFocus()
                        if (name.isNotBlank() && email.isNotBlank() && password.length >= 8) {
                            viewModel.register(email, password, name)
                        }
                    }
                ),
                colors = fieldColors,
                modifier = Modifier.fillMaxWidth(),
            )

            if (state.error != null) {
                Spacer(Modifier.height(8.dp))
                Text(state.error!!, fontSize = 13.sp, color = PacrColors.Red)
            }
        }

        Column {
            PacrCTA(
                label = if (state.isLoading) "Creating account…" else "Create Account",
                enabled = name.isNotBlank() && email.isNotBlank() && password.length >= 8 && !state.isLoading,
                onClick = { viewModel.register(email, password, name) },
            )
            Spacer(Modifier.height(16.dp))
        }
    }
}
