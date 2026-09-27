package com.itsupport.app.data.model

import com.google.gson.annotations.SerializedName

data class User(
    val id: Int? = null,
    val username: String,
    val name: String,
    val role: String,
    val isAdmin: Boolean = false
)

data class LoginRequest(
    val username: String,
    val password: String
)

data class LoginResponse(
    val ok: Boolean = false,
    val message: String? = null,
    val error: String? = null,
    val user: User? = null,
    val token: String? = null
)

data class MeResponse(
    val authenticated: Boolean = false,
    val user: User? = null,
    val error: String? = null
)

data class Ticket(
    val row: Int? = null,
    val no: Int? = null,
    val tanggalLapor: String? = null,
    val namaClient: String,
    val departemen: String? = null,
    val kategori: String? = null,
    val deskripsi: String,
    val prioritas: String? = "Sedang",
    val status: String? = "Open",
    val pic: String? = null,
    val tanggalSelesai: String? = null,
    val durasi: Any? = null,
    val solusi: String? = null,
    val catatan: String? = null
)

data class Options(
    val kategori: List<String> = emptyList(),
    val prioritas: List<String> = emptyList(),
    val status: List<String> = emptyList()
)

data class TicketsResponse(
    val tickets: List<Ticket> = emptyList(),
    val options: Options? = null,
    val error: String? = null
)

data class SummaryByStatus(
    @SerializedName("Open") val open: Int = 0,
    @SerializedName("In Progress") val inProgress: Int = 0,
    @SerializedName("Menunggu Client") val waitingClient: Int = 0,
    @SerializedName("Closed") val closed: Int = 0
)

data class Summary(
    val total: Int = 0,
    val byStatus: SummaryByStatus = SummaryByStatus(),
    val byKategori: Map<String, Int> = emptyMap(),
    val prioritasTinggi: Int = 0
)

data class ApiResponse(
    val ok: Boolean = false,
    val row: Int? = null,
    val error: String? = null,
    val message: String? = null
)
