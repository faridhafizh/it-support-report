package com.itsupport.app.ui.viewmodel

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.LiveData
import androidx.lifecycle.MutableLiveData
import androidx.lifecycle.viewModelScope
import com.itsupport.app.data.model.LoginResponse
import com.itsupport.app.data.network.ApiClient
import com.itsupport.app.data.network.SessionManager
import com.itsupport.app.data.repository.ITSupportRepository
import kotlinx.coroutines.launch

class LoginViewModel(application: Application) : AndroidViewModel(application) {

    val sessionManager = SessionManager(application)
    private val repository = ITSupportRepository(sessionManager)

    private val _loginResult = MutableLiveData<Result<LoginResponse>>()
    val loginResult: LiveData<Result<LoginResponse>> = _loginResult

    private val _loading = MutableLiveData<Boolean>()
    val loading: LiveData<Boolean> = _loading

    fun login(serverUrl: String, username: String, pass: String) {
        _loading.value = true
        sessionManager.saveServerUrl(serverUrl)
        ApiClient.reset()

        viewModelScope.launch {
            val result = repository.login(username, pass)
            result.onSuccess { response ->
                if (response.ok && response.user != null && !response.token.isNullOrEmpty()) {
                    sessionManager.saveSession(
                        token = response.token,
                        username = response.user.username,
                        name = response.user.name,
                        role = response.user.role,
                        isAdmin = response.user.isAdmin
                    )
                }
            }
            _loginResult.value = result
            _loading.value = false
        }
    }
}
