package com.pacr.app.ui.coach

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Snackbar
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.pacr.app.ui.theme.PacrColors
import kotlinx.coroutines.launch

@Composable
fun CoachScreen(
    onBack: () -> Unit,
    vm: CoachViewModel = hiltViewModel(),
) {
    val state by vm.uiState.collectAsState()
    var inputText by remember { mutableStateOf("") }
    val listState = rememberLazyListState()
    val scope = rememberCoroutineScope()
    val snackbarHostState = remember { SnackbarHostState() }

    LaunchedEffect(state.messages.size) {
        if (state.messages.isNotEmpty()) {
            listState.animateScrollToItem(state.messages.size - 1)
        }
    }

    LaunchedEffect(state.limitReached) {
        if (state.limitReached) {
            snackbarHostState.showSnackbar("Daily limit reached (20 messages)")
        }
    }

    Box(
        Modifier
            .fillMaxSize()
            .background(PacrColors.Bg)
            .statusBarsPadding()
            .navigationBarsPadding()
            .imePadding(),
    ) {
        Column(Modifier.fillMaxSize()) {
            // Top bar
            Row(
                Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 8.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                IconButton(onClick = onBack) {
                    Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back", tint = PacrColors.InkMute)
                }
                Text(
                    "Pacr Coach",
                    fontSize = 18.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = PacrColors.Ink,
                    modifier = Modifier.weight(1f),
                )
                state.remainingMessages?.let {
                    Text("$it left", fontSize = 12.sp, color = PacrColors.InkMute)
                }
            }

            if (state.isLoading) {
                LinearProgressIndicator(
                    Modifier.fillMaxWidth(),
                    color = PacrColors.Coral,
                    trackColor = PacrColors.Raised,
                )
            }

            // Messages
            LazyColumn(
                state = listState,
                modifier = Modifier
                    .weight(1f)
                    .padding(horizontal = 16.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                item { Spacer(Modifier.height(8.dp)) }
                items(state.messages) { msg ->
                    MessageBubble(msg)
                }
                item { Spacer(Modifier.height(8.dp)) }
            }

            // Input row
            Row(
                Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 12.dp, vertical = 8.dp),
                verticalAlignment = Alignment.Bottom,
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                OutlinedTextField(
                    value = inputText,
                    onValueChange = { inputText = it },
                    modifier = Modifier.weight(1f),
                    placeholder = { Text("Ask your coach...", color = PacrColors.InkMute) },
                    maxLines = 4,
                    keyboardOptions = KeyboardOptions(imeAction = ImeAction.Send),
                    keyboardActions = KeyboardActions(onSend = {
                        vm.send(inputText)
                        inputText = ""
                    }),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = PacrColors.Coral,
                        unfocusedBorderColor = PacrColors.HairlineStrong,
                        focusedTextColor = PacrColors.Ink,
                        unfocusedTextColor = PacrColors.Ink,
                        cursorColor = PacrColors.Coral,
                        focusedContainerColor = PacrColors.Surface,
                        unfocusedContainerColor = PacrColors.Surface,
                    ),
                    shape = RoundedCornerShape(12.dp),
                )
                IconButton(
                    onClick = {
                        vm.send(inputText)
                        inputText = ""
                    },
                    enabled = inputText.isNotBlank() && !state.isLoading,
                ) {
                    Icon(
                        Icons.AutoMirrored.Filled.Send,
                        contentDescription = "Send",
                        tint = if (inputText.isNotBlank() && !state.isLoading) PacrColors.Coral else PacrColors.InkMute,
                    )
                }
            }
        }

        SnackbarHost(
            hostState = snackbarHostState,
            modifier = Modifier.align(Alignment.BottomCenter),
        ) { data ->
            Snackbar(
                snackbarData = data,
                containerColor = PacrColors.Surface,
                contentColor = PacrColors.Ink,
            )
        }
    }
}

@Composable
private fun MessageBubble(message: ChatMessage) {
    val isUser = message.role == "user"
    Row(
        Modifier.fillMaxWidth(),
        horizontalArrangement = if (isUser) Arrangement.End else Arrangement.Start,
    ) {
        Box(
            Modifier
                .widthIn(max = 280.dp)
                .clip(
                    RoundedCornerShape(
                        topStart = 16.dp,
                        topEnd = 16.dp,
                        bottomStart = if (isUser) 16.dp else 4.dp,
                        bottomEnd = if (isUser) 4.dp else 16.dp,
                    )
                )
                .background(if (isUser) PacrColors.CoralSoft else PacrColors.Surface)
                .padding(12.dp),
        ) {
            Text(
                text = message.content,
                fontSize = 14.sp,
                color = PacrColors.Ink,
                lineHeight = 20.sp,
            )
        }
    }
}
