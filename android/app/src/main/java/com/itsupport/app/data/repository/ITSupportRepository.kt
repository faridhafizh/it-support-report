package com.itsupport.app.data.repository

import com.itsupport.app.data.api.ITSupportApiService
import com.itsupport.app.data.model.*
import com.itsupport.app.data.network.ApiClient
import com.itsupport.app.data.network.SessionManager
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class ITSupportRepository(private val sessionManager: SessionManager) {

    private val api: ITSupportApiService
        get() = ApiClient.getApiService(sessionManager)

    suspend fun login(username: String, pass: String): Result<LoginResponse> = withContext(Dispatchers.IO) {
        try {
            val response = api.login(LoginRequest(username, pass))
            if (response.isSuccessful && response.body() != null) {
                Result.success(response.body()!!)
            } else {
                val errorMsg = response.errorBody()?.string() ?: "Login gagal (${response.code()})"
                Result.failure(Exception(errorMsg))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun getTickets(): Result<TicketsResponse> = withContext(Dispatchers.IO) {
        try {
            val response = api.getTickets()
            if (response.isSuccessful && response.body() != null) {
                Result.success(response.body()!!)
            } else {
                Result.failure(Exception(response.errorBody()?.string() ?: "Gagal mengambil data tiket"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun createTicket(ticket: Ticket): Result<ApiResponse> = withContext(Dispatchers.IO) {
        try {
            val response = api.createTicket(ticket)
            if (response.isSuccessful && response.body() != null) {
                Result.success(response.body()!!)
            } else {
                Result.failure(Exception(response.errorBody()?.string() ?: "Gagal membuat tiket"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun updateTicket(row: Int, updates: Map<String, String?>): Result<ApiResponse> = withContext(Dispatchers.IO) {
        try {
            val response = api.updateTicket(row, updates)
            if (response.isSuccessful && response.body() != null) {
                Result.success(response.body()!!)
            } else {
                Result.failure(Exception(response.errorBody()?.string() ?: "Gagal memperbarui tiket"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun deleteTicket(row: Int): Result<ApiResponse> = withContext(Dispatchers.IO) {
        try {
            val response = api.deleteTicket(row)
            if (response.isSuccessful && response.body() != null) {
                Result.success(response.body()!!)
            } else {
                Result.failure(Exception(response.errorBody()?.string() ?: "Gagal menghapus tiket"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun getSummary(): Result<Summary> = withContext(Dispatchers.IO) {
        try {
            val response = api.getSummary()
            if (response.isSuccessful && response.body() != null) {
                Result.success(response.body()!!)
            } else {
                Result.failure(Exception(response.errorBody()?.string() ?: "Gagal mengambil ringkasan KPI"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun logout(): Result<ApiResponse> = withContext(Dispatchers.IO) {
        try {
            val response = api.logout()
            sessionManager.clearSession()
            ApiClient.reset()
            if (response.isSuccessful && response.body() != null) {
                Result.success(response.body()!!)
            } else {
                Result.success(ApiResponse(ok = true))
            }
        } catch (e: Exception) {
            sessionManager.clearSession()
            ApiClient.reset()
            Result.success(ApiResponse(ok = true))
        }
    }
}
