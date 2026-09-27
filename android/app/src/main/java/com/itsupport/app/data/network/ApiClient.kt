package com.itsupport.app.data.network

import com.itsupport.app.data.api.ITSupportApiService
import okhttp3.Interceptor
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.util.concurrent.TimeUnit

object ApiClient {
    private var retrofit: Retrofit? = null
    private var currentBaseUrl: String? = null

    fun getApiService(sessionManager: SessionManager): ITSupportApiService {
        val baseUrl = sessionManager.getServerUrl() + "/"

        if (retrofit == null || currentBaseUrl != baseUrl) {
            currentBaseUrl = baseUrl

            val logging = HttpLoggingInterceptor().apply {
                level = HttpLoggingInterceptor.Level.BODY
            }

            val authInterceptor = Interceptor { chain ->
                val requestBuilder = chain.request().newBuilder()
                val token = sessionManager.getToken()
                if (!token.isNullOrEmpty()) {
                    requestBuilder.addHeader("Authorization", "Bearer $token")
                    requestBuilder.addHeader("Cookie", "auth_session=$token")
                }
                chain.proceed(requestBuilder.build())
            }

            val client = OkHttpClient.Builder()
                .addInterceptor(authInterceptor)
                .addInterceptor(logging)
                .connectTimeout(15, TimeUnit.SECONDS)
                .readTimeout(15, TimeUnit.SECONDS)
                .build()

            retrofit = Retrofit.Builder()
                .baseUrl(baseUrl)
                .client(client)
                .addConverterFactory(GsonConverterFactory.create())
                .build()
        }

        return retrofit!!.create(ITSupportApiService::class.java)
    }

    fun reset() {
        retrofit = null
        currentBaseUrl = null
    }
}
