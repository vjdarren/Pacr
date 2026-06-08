package com.pacr.app.ui.navigation

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.navigation
import androidx.navigation.compose.rememberNavController
import com.pacr.app.data.datastore.OnboardingDataStore
import com.pacr.app.data.datastore.TokenDataStore
import com.pacr.app.data.health.HealthConnectManager
import com.pacr.app.data.sync.HistoricalSyncManager
import com.pacr.app.ui.auth.AuthNavEvent
import com.pacr.app.ui.auth.LoginScreen
import com.pacr.app.ui.auth.RegisterScreen
import com.pacr.app.ui.coach.CoachScreen
import com.pacr.app.ui.onboarding.OnboardingNavEvent
import com.pacr.app.ui.onboarding.OnboardingViewModel
import com.pacr.app.ui.run.PostRunSummaryScreen
import com.pacr.app.ui.run.RunTrackingScreen
import com.pacr.app.ui.screen.HealthPermissionScreen
import com.pacr.app.ui.screen.SplashScreen
import com.pacr.app.ui.screen.UnsupportedScreen
import com.pacr.app.ui.screen.onboarding.AvailabilityScreen
import com.pacr.app.ui.screen.onboarding.DateScreen
import com.pacr.app.ui.screen.onboarding.DurationScreen
import com.pacr.app.ui.screen.onboarding.FitnessScreen
import com.pacr.app.ui.screen.onboarding.GoalScreen
import com.pacr.app.ui.screen.onboarding.HistoricalSyncScreen
import com.pacr.app.ui.screen.onboarding.RaceScreen
import com.pacr.app.ui.today.TodayScreen

object Routes {
    const val SPLASH          = "splash"
    const val SDK_UNAVAILABLE = "sdk_unavailable"
    const val LOGIN           = "login"
    const val REGISTER        = "register"
    const val ONBOARDING      = "onboarding"
    const val GOAL            = "goal"
    const val RACE            = "race"
    const val DATE            = "date"
    const val AVAILABILITY    = "availability"
    const val DURATION        = "duration"
    const val FITNESS         = "fitness"
    const val HEALTH_CONNECT  = "health_connect"
    const val HISTORICAL_SYNC = "historical_sync"
    const val TODAY           = "today"
    const val RUN_TRACKING    = "run_tracking/{sessionId}"
    const val COACH           = "coach"
    const val POST_RUN        = "post_run/{runId}"

    fun runTracking(sessionId: String?) = "run_tracking/${sessionId ?: "none"}"
    fun postRun(runId: String) = "post_run/$runId"
}

@Composable
fun PacrNavGraph(
    navController: NavHostController = rememberNavController(),
    sdkAvailability: HealthConnectManager.SdkAvailability?,
    onboardingDataStore: OnboardingDataStore,
    historicalSyncManager: HistoricalSyncManager,
    tokenDataStore: TokenDataStore,
) {
    val isOnboardingComplete by onboardingDataStore.isComplete.collectAsState(initial = null)

    NavHost(navController = navController, startDestination = Routes.SPLASH) {

        // ── Splash ──────────────────────────────────────────────────────────
        composable(Routes.SPLASH) {
            SplashScreen(onSplashComplete = {})

            LaunchedEffect(sdkAvailability, isOnboardingComplete) {
                if (sdkAvailability == null || isOnboardingComplete == null) return@LaunchedEffect
                val destination = when {
                    sdkAvailability == HealthConnectManager.SdkAvailability.UNAVAILABLE ->
                        Routes.SDK_UNAVAILABLE
                    tokenDataStore.hasValidToken() -> Routes.TODAY
                    else -> Routes.LOGIN
                }
                navController.navigate(destination) {
                    popUpTo(Routes.SPLASH) { inclusive = true }
                }
            }
        }

        composable(Routes.SDK_UNAVAILABLE) { UnsupportedScreen() }

        // ── Auth ─────────────────────────────────────────────────────────────
        composable(Routes.LOGIN) {
            val onboardingComplete = isOnboardingComplete ?: false
            LoginScreen(
                isOnboardingComplete = onboardingComplete,
                onSuccess = { event ->
                    val dest = when (event) {
                        is AuthNavEvent.NavigateToToday -> Routes.TODAY
                        is AuthNavEvent.NavigateToOnboarding -> Routes.ONBOARDING
                    }
                    navController.navigate(dest) {
                        popUpTo(Routes.LOGIN) { inclusive = true }
                    }
                },
                onCreateAccount = { navController.navigate(Routes.REGISTER) },
            )
        }

        composable(Routes.REGISTER) {
            RegisterScreen(
                onSuccess = {
                    navController.navigate(Routes.ONBOARDING) {
                        popUpTo(Routes.LOGIN) { inclusive = true }
                    }
                },
                onBack = { navController.popBackStack() },
            )
        }

        // ── Today / Home ─────────────────────────────────────────────────────
        composable(Routes.TODAY) {
            TodayScreen(
                onStartRun = { sessionId ->
                    navController.navigate(Routes.runTracking(sessionId))
                },
                onOpenCoach = { navController.navigate(Routes.COACH) },
            )
        }

        // ── Run Tracking ──────────────────────────────────────────────────────
        composable(Routes.RUN_TRACKING) { backStackEntry ->
            val sessionId = backStackEntry.arguments?.getString("sessionId")
                ?.takeIf { it != "none" }
            RunTrackingScreen(
                sessionId = sessionId,
                onRunFinished = { runId ->
                    navController.navigate(Routes.postRun(runId)) {
                        popUpTo(Routes.TODAY)
                    }
                },
                onBack = { navController.popBackStack() },
            )
        }

        composable(Routes.POST_RUN) { backStackEntry ->
            val runId = backStackEntry.arguments?.getString("runId") ?: return@composable
            PostRunSummaryScreen(
                runId = runId,
                onDone = {
                    navController.navigate(Routes.TODAY) {
                        popUpTo(Routes.TODAY) { inclusive = true }
                    }
                },
            )
        }

        // ── Coach Chat ────────────────────────────────────────────────────────
        composable(Routes.COACH) {
            CoachScreen(
                onBack = { navController.popBackStack() },
            )
        }

        // ── Onboarding wizard — all steps share one ViewModel ───────────────
        navigation(startDestination = Routes.GOAL, route = Routes.ONBOARDING) {

            composable(Routes.GOAL) {
                val vm: OnboardingViewModel = hiltViewModel(
                    navController.getBackStackEntry(Routes.ONBOARDING)
                )
                GoalScreen(vm) { navController.navigate(Routes.RACE) }
            }

            composable(Routes.RACE) {
                val vm: OnboardingViewModel = hiltViewModel(
                    navController.getBackStackEntry(Routes.ONBOARDING)
                )
                RaceScreen(vm) { navController.navigate(Routes.DATE) }
            }

            composable(Routes.DATE) {
                val vm: OnboardingViewModel = hiltViewModel(
                    navController.getBackStackEntry(Routes.ONBOARDING)
                )
                DateScreen(vm) { navController.navigate(Routes.AVAILABILITY) }
            }

            composable(Routes.AVAILABILITY) {
                val vm: OnboardingViewModel = hiltViewModel(
                    navController.getBackStackEntry(Routes.ONBOARDING)
                )
                AvailabilityScreen(vm) { navController.navigate(Routes.DURATION) }
            }

            composable(Routes.DURATION) {
                val vm: OnboardingViewModel = hiltViewModel(
                    navController.getBackStackEntry(Routes.ONBOARDING)
                )
                DurationScreen(vm) { navController.navigate(Routes.FITNESS) }
            }

            composable(Routes.FITNESS) {
                val vm: OnboardingViewModel = hiltViewModel(
                    navController.getBackStackEntry(Routes.ONBOARDING)
                )
                LaunchedEffect(vm) {
                    vm.navEvents.collect { event ->
                        when (event) {
                            OnboardingNavEvent.GoToHealthConnect ->
                                navController.navigate(Routes.HEALTH_CONNECT) {
                                    popUpTo(Routes.ONBOARDING) { inclusive = true }
                                }
                        }
                    }
                }
                FitnessScreen(vm) {}
            }

            composable(Routes.HEALTH_CONNECT) {
                HealthPermissionScreen(
                    onPermissionsGranted = {
                        navController.navigate(Routes.HISTORICAL_SYNC) {
                            popUpTo(Routes.HEALTH_CONNECT) { inclusive = true }
                        }
                    },
                )
            }

            composable(Routes.HISTORICAL_SYNC) {
                HistoricalSyncScreen(
                    historicalSyncManager = historicalSyncManager,
                    onSyncComplete = {
                        navController.navigate(Routes.TODAY) {
                            popUpTo(Routes.ONBOARDING) { inclusive = true }
                        }
                    },
                )
            }
        }
    }
}
