package com.itsupport.app.ui.viewmodel

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.LiveData
import androidx.lifecycle.MutableLiveData
import androidx.lifecycle.viewModelScope
import com.itsupport.app.data.model.*
import com.itsupport.app.data.network.SessionManager
import com.itsupport.app.data.repository.ITSupportRepository
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class DashboardViewModel(application: Application) : AndroidViewModel(application) {

    val sessionManager = SessionManager(application)
    private val repository = ITSupportRepository(sessionManager)

    private val _tickets = MutableLiveData<List<Ticket>>()
    val tickets: LiveData<List<Ticket>> = _tickets

    private val _filteredTickets = MutableLiveData<List<Ticket>>()
    val filteredTickets: LiveData<List<Ticket>> = _filteredTickets

    private val _summary = MutableLiveData<Summary>()
    val summary: LiveData<Summary> = _summary

    private val _options = MutableLiveData<Options>()
    val options: LiveData<Options> = _options

    private val _loading = MutableLiveData<Boolean>()
    val loading: LiveData<Boolean> = _loading

    private val _actionResult = MutableLiveData<Result<ApiResponse>>()
    val actionResult: LiveData<Result<ApiResponse>> = _actionResult

    private var currentFilterStatus: String = "Semua"
    private var currentSearchQuery: String = ""

    fun loadData() {
        _loading.value = true
        viewModelScope.launch {
            val ticketsResult = repository.getTickets()
            val summaryResult = repository.getSummary()

            ticketsResult.onSuccess { resp ->
                _tickets.value = resp.tickets
                if (resp.options != null) {
                    _options.value = resp.options
                }
                applyFilters()
            }

            summaryResult.onSuccess { sum ->
                _summary.value = sum
            }

            _loading.value = false
        }
    }

    fun setFilterStatus(status: String) {
        currentFilterStatus = status
        applyFilters()
    }

    fun setSearchQuery(query: String) {
        currentSearchQuery = query
        applyFilters()
    }

    private fun applyFilters() {
        val list = _tickets.value ?: emptyList()
        val filtered = list.filter { ticket ->
            val matchStatus = if (currentFilterStatus == "Semua") true else ticket.status.equals(currentFilterStatus, ignoreCase = true)
            val matchQuery = if (currentSearchQuery.isBlank()) true else {
                ticket.namaClient.contains(currentSearchQuery, ignoreCase = true) ||
                ticket.deskripsi.contains(currentSearchQuery, ignoreCase = true) ||
                (ticket.departemen?.contains(currentSearchQuery, ignoreCase = true) == true) ||
                (ticket.pic?.contains(currentSearchQuery, ignoreCase = true) == true)
            }
            matchStatus && matchQuery
        }
        _filteredTickets.value = filtered
    }

    fun createTicket(
        client: String,
        dept: String,
        kategori: String,
        prioritas: String,
        status: String,
        deskripsi: String,
        pic: String,
        solusi: String,
        catatan: String
    ) {
        _loading.value = true
        val today = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(Date())
        val isClosed = status.equals("Closed", ignoreCase = true)

        val newTicket = Ticket(
            tanggalLapor = today,
            namaClient = client,
            departemen = dept,
            kategori = kategori,
            prioritas = prioritas,
            status = status,
            deskripsi = deskripsi,
            pic = if (pic.isBlank()) sessionManager.getName() else pic,
            tanggalSelesai = if (isClosed) today else null,
            solusi = solusi,
            catatan = catatan
        )

        viewModelScope.launch {
            val result = repository.createTicket(newTicket)
            _actionResult.value = result
            if (result.isSuccess) {
                loadData()
            } else {
                _loading.value = false
            }
        }
    }

    fun updateTicketStatus(row: Int, newStatus: String) {
        _loading.value = true
        val today = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(Date())
        val updates = mutableMapOf<String, String?>(
            "status" to newStatus
        )
        if (newStatus.equals("Closed", ignoreCase = true)) {
            updates["tanggalSelesai"] = today
        }

        viewModelScope.launch {
            val result = repository.updateTicket(row, updates)
            _actionResult.value = result
            if (result.isSuccess) {
                loadData()
            } else {
                _loading.value = false
            }
        }
    }

    fun editTicket(
        row: Int,
        status: String,
        pic: String,
        solusi: String,
        catatan: String
    ) {
        _loading.value = true
        val today = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(Date())
        val updates = mutableMapOf<String, String?>(
            "status" to status,
            "pic" to pic,
            "solusi" to solusi,
            "catatan" to catatan
        )
        if (status.equals("Closed", ignoreCase = true)) {
            updates["tanggalSelesai"] = today
        }

        viewModelScope.launch {
            val result = repository.updateTicket(row, updates)
            _actionResult.value = result
            if (result.isSuccess) {
                loadData()
            } else {
                _loading.value = false
            }
        }
    }

    fun deleteTicket(row: Int) {
        _loading.value = true
        viewModelScope.launch {
            val result = repository.deleteTicket(row)
            _actionResult.value = result
            if (result.isSuccess) {
                loadData()
            } else {
                _loading.value = false
            }
        }
    }

    fun logout(onComplete: () -> Unit) {
        viewModelScope.launch {
            repository.logout()
            onComplete()
        }
    }
}
