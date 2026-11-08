/**
 * PHASE 6.4 — WebRTC Video Chat with Cloud Recording
 * Real-time peer-to-peer video communication with server-side recording
 */

const { createClient } = require('@supabase/supabase-js');

class WebRTCVideoChat {
  constructor(supabaseUrl, supabaseKey) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.activeCalls = new Map();
    this.recordingEnabled = true;
  }

  /**
   * Initialize peer connection with ICE servers
   */
  createPeerConnection(callId, isInitiator = false) {
    const peerConfig = {
      iceServers: [
        {
          urls: [
            'stun:stun.l.google.com:19302',
            'stun:stun1.l.google.com:19302',
            'stun:stun2.l.google.com:19302'
          ]
        },
        {
          urls: process.env.TURN_SERVER_URL,
          username: process.env.TURN_USERNAME,
          credential: process.env.TURN_PASSWORD
        }
      ]
    };

    const peerConnection = new RTCPeerConnection(peerConfig);

    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendSignaling(callId, {
          type: 'ice-candidate',
          candidate: event.candidate
        });
      }
    };

    // Handle remote stream
    peerConnection.ontrack = (event) => {
      this.handleRemoteStream(callId, event.streams[0]);
    };

    // Handle connection state changes
    peerConnection.onconnectionstatechange = () => {
      console.log(`[${callId}] Connection state: ${peerConnection.connectionState}`);
      if (peerConnection.connectionState === 'failed') {
        this.handleConnectionFailure(callId);
      }
    };

    this.activeCalls.set(callId, { peerConnection, isInitiator });
    return peerConnection;
  }

  /**
   * Initialize local video stream
   */
  async getLocalStream(callId, options = {}) {
    const {
      videoEnabled = true,
      audioEnabled = true,
      videoConstraints = { width: { ideal: 1280 }, height: { ideal: 720 } }
    } = options;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: videoEnabled ? videoConstraints : false,
        audio: audioEnabled ? { echoCancellation: true } : false
      });

      const callData = this.activeCalls.get(callId);
      if (callData) {
        stream.getTracks().forEach(track => {
          callData.peerConnection.addTrack(track, stream);
        });
        callData.localStream = stream;
      }

      return stream;
    } catch (error) {
      console.error('Error accessing media devices:', error);
      throw error;
    }
  }

  /**
   * Initiate offer (for caller)
   */
  async initiateCall(callId, remoteUserId) {
    const callData = this.activeCalls.get(callId);
    if (!callData) throw new Error('Call not found');

    try {
      const offer = await callData.peerConnection.createOffer();
      await callData.peerConnection.setLocalDescription(offer);

      // Store call in database
      await this.supabase.from('video_calls').insert({
        id: callId,
        caller_id: callData.userId,
        callee_id: remoteUserId,
        status: 'ringing',
        started_at: new Date().toISOString()
      });

      // Send offer via signaling
      await this.sendSignaling(callId, {
        type: 'offer',
        sdp: offer.sdp
      });

      return offer;
    } catch (error) {
      console.error('Offer creation error:', error);
      throw error;
    }
  }

  /**
   * Handle incoming offer (for callee)
   */
  async handleOffer(callId, offer) {
    const callData = this.activeCalls.get(callId);
    if (!callData) throw new Error('Call not found');

    try {
      await callData.peerConnection.setRemoteDescription(
        new RTCSessionDescription(offer)
      );

      const answer = await callData.peerConnection.createAnswer();
      await callData.peerConnection.setLocalDescription(answer);

      // Send answer
      await this.sendSignaling(callId, {
        type: 'answer',
        sdp: answer.sdp
      });

      // Update call status
      await this.supabase
        .from('video_calls')
        .update({ status: 'connected' })
        .eq('id', callId);

      return answer;
    } catch (error) {
      console.error('Offer handling error:', error);
      throw error;
    }
  }

  /**
   * Handle ICE candidates
   */
  async handleIceCandidate(callId, candidate) {
    const callData = this.activeCalls.get(callId);
    if (!callData) throw new Error('Call not found');

    try {
      await callData.peerConnection.addIceCandidate(
        new RTCIceCandidate(candidate)
      );
    } catch (error) {
      console.error('ICE candidate error:', error);
    }
  }

  /**
   * Record video stream
   */
  startRecording(callId) {
    const callData = this.activeCalls.get(callId);
    if (!callData) throw new Error('Call not found');

    const recordingStream = new MediaStream();

    // Add local video
    if (callData.localStream) {
      callData.localStream.getVideoTracks().forEach(track => {
        recordingStream.addTrack(track);
      });
    }

    // Add remote video
    const remoteVideo = new MediaStream();
    callData.peerConnection.getReceivers().forEach(receiver => {
      if (receiver.track && receiver.track.kind === 'video') {
        remoteVideo.addTrack(receiver.track);
      }
    });
    remoteVideo.getTracks().forEach(track => recordingStream.addTrack(track));

    const mediaRecorder = new MediaRecorder(recordingStream, {
      mimeType: 'video/webm;codecs=vp9,opus'
    });

    const chunks = [];
    mediaRecorder.ondataavailable = (event) => chunks.push(event.data);
    mediaRecorder.onstop = () => this.uploadRecording(callId, chunks);

    mediaRecorder.start();
    callData.mediaRecorder = mediaRecorder;

    return mediaRecorder;
  }

  /**
   * Upload recording to cloud storage
   */
  async uploadRecording(callId, chunks) {
    try {
      const blob = new Blob(chunks, { type: 'video/webm' });
      const fileName = `recordings/${callId}-${Date.now()}.webm`;

      const { data, error } = await this.supabase.storage
        .from('video-recordings')
        .upload(fileName, blob);

      if (error) throw error;

      // Store recording metadata
      await this.supabase.from('video_recordings').insert({
        call_id: callId,
        file_path: fileName,
        file_size: blob.size,
        duration: 0, // Would calculate from metadata
        uploaded_at: new Date().toISOString()
      });

      console.log(`✅ Recording saved: ${fileName}`);
    } catch (error) {
      console.error('Recording upload error:', error);
    }
  }

  /**
   * End call and cleanup
   */
  async endCall(callId) {
    const callData = this.activeCalls.get(callId);
    if (!callData) return;

    // Stop recording
    if (callData.mediaRecorder && callData.mediaRecorder.state === 'recording') {
      callData.mediaRecorder.stop();
    }

    // Stop local stream tracks
    if (callData.localStream) {
      callData.localStream.getTracks().forEach(track => track.stop());
    }

    // Close peer connection
    callData.peerConnection.close();

    // Update call status
    await this.supabase
      .from('video_calls')
      .update({
        status: 'ended',
        ended_at: new Date().toISOString()
      })
      .eq('id', callId);

    this.activeCalls.delete(callId);
  }

  /**
   * Send signaling message (offer/answer/ICE)
   */
  async sendSignaling(callId, message) {
    try {
      await this.supabase
        .from('call_signaling')
        .insert({
          call_id: callId,
          type: message.type,
          payload: message,
          created_at: new Date().toISOString()
        });
    } catch (error) {
      console.error('Signaling error:', error);
    }
  }

  /**
   * Handle remote stream
   */
  handleRemoteStream(callId, stream) {
    const callData = this.activeCalls.get(callId);
    if (callData) {
      callData.remoteStream = stream;
      // Emit event to UI to display remote video
      console.log(`Remote stream received for call ${callId}`);
    }
  }

  /**
   * Handle connection failure with retry
   */
  async handleConnectionFailure(callId) {
    console.log(`Connection failed for ${callId}, attempting reconnect...`);
    const callData = this.activeCalls.get(callId);
    if (!callData) return;

    // Restart ICE gathering
    callData.peerConnection.restartIce();

    // Retry after delay
    await new Promise(resolve => setTimeout(resolve, 3000));
    // Re-create offer and send
  }

  /**
   * Get call statistics
   */
  async getCallStats(callId) {
    const callData = this.activeCalls.get(callId);
    if (!callData) return null;

    const stats = await callData.peerConnection.getStats();
    const report = {
      audio: {},
      video: {},
      connection: {}
    };

    stats.forEach(stat => {
      if (stat.type === 'inbound-rtp' && stat.kind === 'video') {
        report.video.bytesReceived = stat.bytesReceived;
        report.video.packetsReceived = stat.packetsReceived;
      }
      if (stat.type === 'outbound-rtp' && stat.kind === 'video') {
        report.video.bytesSent = stat.bytesSent;
        report.video.framesSent = stat.framesSent;
      }
      if (stat.type === 'candidate-pair' && stat.state === 'succeeded') {
        report.connection.currentRoundTripTime = stat.currentRoundTripTime;
        report.connection.availableOutgoingBitrate = stat.availableOutgoingBitrate;
      }
    });

    return report;
  }
}

module.exports = WebRTCVideoChat;
