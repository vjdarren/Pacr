package com.pacr.app.data.location

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Intent
import android.os.IBinder
import androidx.core.app.NotificationCompat
import com.pacr.app.R

class RunForegroundService : Service() {

    private val notificationManager by lazy {
        getSystemService(NotificationManager::class.java)
    }

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val elapsedSec = intent?.getIntExtra(EXTRA_ELAPSED_SEC, 0) ?: 0
        val distanceKm = intent?.getDoubleExtra(EXTRA_DISTANCE_KM, 0.0) ?: 0.0

        startForeground(NOTIFICATION_ID, buildNotification(elapsedSec, distanceKm))
        return START_STICKY
    }

    fun updateStats(elapsedSec: Int, distanceKm: Double) {
        notificationManager.notify(NOTIFICATION_ID, buildNotification(elapsedSec, distanceKm))
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun buildNotification(elapsedSec: Int, distanceKm: Double): Notification {
        val h = elapsedSec / 3600
        val m = (elapsedSec % 3600) / 60
        val s = elapsedSec % 60
        val timeStr = if (h > 0) "%d:%02d:%02d".format(h, m, s) else "%d:%02d".format(m, s)

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle("Run in progress")
            .setContentText("$timeStr  ·  ${"%.2f".format(distanceKm)} km")
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .build()
    }

    private fun createNotificationChannel() {
        val channel = NotificationChannel(
            CHANNEL_ID,
            "Run tracking",
            NotificationManager.IMPORTANCE_LOW,
        ).apply { description = "Shows live run stats while tracking a run" }
        notificationManager.createNotificationChannel(channel)
    }

    companion object {
        const val CHANNEL_ID = "pacr_run_tracking"
        const val NOTIFICATION_ID = 1001
        const val EXTRA_ELAPSED_SEC = "elapsed_sec"
        const val EXTRA_DISTANCE_KM = "distance_km"
    }
}
