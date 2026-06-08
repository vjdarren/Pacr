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
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
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
fun LoginScreen(
    isOnboardingComplete: Boolean,
    onSuccess: (AuthNavEvent) -> Unit,
    onCreateAccount: () -> Unit,
    viewModel: AuthViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsState()
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    val focusManager = LocalFocusManager.current

    LaunchedEffect(viewModel) {
        viewModel.navEvents.collect { event -> onSuccess(event) }
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
            Spacer(Modifier.height(48.dp))

            Text(
                "Pacr.",
                fontSize = 36.sp,
                fontWeight = FontWeight.ExtraBold,
                color = PacrColors.Coral,
                letterSpacing = (-1).sp,
            )

            Spacer(Modifier.height(8.dp))

            Text(
                "Sign in to continue",
                fontSize = 22.sp,
                fontWeight = FontWeight.SemiBold,
                color = PacrColors.Ink,
            )

            Spacer(Modifier.height(32.dp))

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
                        if (email.isNotBlank() && password.isNotBlank()) {
                            viewModel.login(email, password, isOnboardingComplete)
                        }
                    }
                ),
                colors = fieldColors,
                modifier = Modifier.fillMaxWidth(),
            )

            if (state.error != null) {
                Spacer(Modifier.height(8.dp))
                Text(
                    state.error!!,
                    fontSize = 13.sp,
                    color = PacrColors.Red,
                )
            }
        }

        Column {
            PacrCTA(
                label = if (state.isLoading) "Signing in…" else "Sign In",
                enabled = email.isNotBlank() && password.isNotBlank() && !state.isLoading,
                onClick = { viewModel.login(email, password, isOnboardingComplete) },
            )

            Spacer(Modifier.height(12.dp))

            TextButton(
                onClick = onCreateAccount,
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text(
                    "Don't have an account? Create one",
                    color = PacrColors.InkSoft,
                    fontSize = 14.sp,
                )
            }

            Spacer(Modifier.height(8.dp))
        }
    }
}
