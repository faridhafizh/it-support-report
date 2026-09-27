package com.itsupport.app.data.api

import com.itsupport.app.data.model.*
import retrofit2.Response
import retrofit2.http.*

interface ITSupportApiService {

    @POST("api/auth/login")
    suspend fun login(
        @Body request: LoginRequest
    ): Response<LoginResponse>

    @GET("api/auth/me")
    suspend fun getMe(): Response<MeResponse>

    @POST("api/auth/logout")
    suspend fun logout(): Response<ApiResponse>

    @GET("api/tickets")
    suspend fun getTickets(): Response<TicketsResponse>

    @POST("api/tickets")
    suspend fun createTicket(
        @Body ticket: Ticket
    ): Response<ApiResponse>

    @PATCH("api/tickets/{row}")
    suspend fun updateTicket(
        @Path("row") row: Int,
        @Body updates: Map<String, String?>
    ): Response<ApiResponse>

    @DELETE("api/tickets/{row}")
    suspend fun deleteTicket(
        @Path("row") row: Int
    ): Response<ApiResponse>

    @GET("api/summary")
    suspend fun getSummary(): Response<Summary>
}
