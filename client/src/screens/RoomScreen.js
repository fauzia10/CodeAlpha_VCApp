import React, { useState, useContext, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  ScrollView,
  Dimensions,
  TextInput,
  Linking,
  ActivityIndicator,
  Platform,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { RTCView } from '../services/webrtc_shims';
import Svg, { Polyline } from 'react-native-svg';
import * as DocumentPicker from 'expo-document-picker';
import { AuthContext } from '../context/AuthContext';
import { RoomContext } from '../context/RoomContext';
import { getColors } from '../theme/colors';

const { width } = Dimensions.get('window');
const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://10.0.2.2:5000';

export default function RoomScreen() {
  const { user, token, themeMode } = useContext(AuthContext);
  const {
    roomId,
    localStream,
    remoteStreams,
    participants,
    messages,
    whiteboardLines,
    setWhiteboardLines,
    isAudioMuted,
    isVideoMuted,
    isScreenSharing,
    toggleAudio,
    toggleVideo,
    toggleScreenShare,
    sendMessage,
    sendFileMessage,
    sendWhiteboardData,
    leaveRoom,
    setLastMeetingSummary,
  } = useContext(RoomContext);

  const COLORS = getColors(themeMode);
  const styles = getStyles(COLORS);

  const [activeTab, setActiveTab] = useState('video'); // 'video' | 'chat' | 'whiteboard'
  const [redoStack, setRedoStack] = useState([]);
  const [showChatSidebar, setShowChatSidebar] = useState(false);
  const [isWideScreen, setIsWideScreen] = useState(Platform.OS === 'web' && Dimensions.get('window').width > 768);

  // Monitor screen width adjustments for responsive layout
  React.useEffect(() => {
    const handleResize = () => {
      setIsWideScreen(Platform.OS === 'web' && Dimensions.get('window').width > 768);
    };
    const subscription = Dimensions.addEventListener('change', handleResize);
    return () => {
      subscription?.remove();
    };
  }, []);
  const [messageText, setMessageText] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  // Whiteboard drawing tools state
  const [strokeColor, setStrokeColor] = useState('#1e293b');
  const [strokeThickness, setStrokeThickness] = useState(4);
  const [isEraser, setIsEraser] = useState(false);

  const chatScrollRef = useRef(null);

  const copyRoomIdToClipboard = async () => {
    await Clipboard.setStringAsync(roomId || '');
    Alert.alert('Copied', 'Room ID copied to clipboard!');
  };

  const handleSendMessage = () => {
    if (!messageText.trim()) return;
    sendMessage(messageText);
    setMessageText('');
  };

  const handlePickAndUploadFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const asset = result.assets[0];
      setIsUploading(true);

      // Create multipart FormData payload
      const formData = new FormData();
      formData.append('file', {
        uri: asset.uri,
        name: asset.name,
        type: asset.mimeType || 'application/octet-stream',
      });

      const response = await fetch(`${API_URL}/api/files/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await response.json();
      setIsUploading(false);

      if (!response.ok) {
        throw new Error(data.message || 'File upload failed');
      }

      // Broadcast file message metadata via socket
      sendFileMessage(
        data.fileName,
        data.fileSize,
        data.mimeType,
        data.downloadUrl
      );
    } catch (error) {
      setIsUploading(false);
      Alert.alert('Upload Error', error.message || 'Could not upload file');
    }
  };

  const handleDownloadFile = (relativeUrl) => {
    const fullUrl = `${API_URL}${relativeUrl}`;
    Linking.openURL(fullUrl).catch(() => {
      Alert.alert('Download Error', 'Could not open download link');
    });
  };

  const handleLeaveRoom = async () => {
    setIsLeaving(true);
    // Request meeting summary from backend if there are messages
    if (messages && messages.length > 0 && roomId) {
      try {
        console.log('Requesting Gemini meeting summary for room:', roomId);
        await Promise.race([
          (async () => {
            try {
              const response = await fetch(`${API_URL}/api/rooms/${roomId}/summary`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({
                  messages: messages.map((m) => ({
                    username: m.username,
                    content: m.content,
                    createdAt: m.createdAt,
                  })),
                }),
              });
              const data = await response.json();
              if (response.ok) {
                setLastMeetingSummary(data);
              }
            } catch (err) {
              console.error('Error generating summary:', err);
            }
          })(),
          new Promise((resolve) => setTimeout(resolve, 4000)), // 4-second timeout safety fallback
        ]);
      } catch (err) {
        console.error(err);
      }
    }
    setIsLeaving(false);
    leaveRoom();
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // Whiteboard drawing event handlers
  const canvasRef = useRef(null);
  const isDrawingRef = useRef(false);
  const whiteboardLinesRef = useRef([]);

  React.useEffect(() => {
    whiteboardLinesRef.current = whiteboardLines;
  }, [whiteboardLines]);

  const getCoordinates = (event) => {
    if (Platform.OS === 'web') {
      const rect = canvasRef.current ? canvasRef.current.getBoundingClientRect() : { left: 0, top: 0 };
      let clientX, clientY;
      
      // Handle touch coordinates first if it is a touch event on web
      if (event.nativeEvent.touches && event.nativeEvent.touches.length > 0) {
        clientX = event.nativeEvent.touches[0].clientX;
        clientY = event.nativeEvent.touches[0].clientY;
      } else if (event.touches && event.touches.length > 0) {
        clientX = event.touches[0].clientX;
        clientY = event.touches[0].clientY;
      } else if (event.clientX !== undefined) {
        clientX = event.clientX;
        clientY = event.clientY;
      } else if (event.nativeEvent.clientX !== undefined) {
        clientX = event.nativeEvent.clientX;
        clientY = event.nativeEvent.clientY;
      } else {
        clientX = event.nativeEvent.locationX || 0;
        clientY = event.nativeEvent.locationY || 0;
      }
      
      return {
        x: clientX - rect.left,
        y: clientY - rect.top,
      };
    } else {
      const { locationX, locationY } = event.nativeEvent;
      return { x: locationX || 0, y: locationY || 0 };
    }
  };

  const handleDrawStart = (event) => {
    isDrawingRef.current = true;
    setRedoStack([]); // Clear redo stack on new drawing actions
    const { x, y } = getCoordinates(event);
    const point = `${x.toFixed(0)},${y.toFixed(0)}`;
    
    const newLine = {
      color: isEraser ? '#ffffff' : strokeColor,
      thickness: isEraser ? 24 : strokeThickness,
      points: [point],
    };

    const updatedLines = [...whiteboardLinesRef.current, newLine];
    setWhiteboardLines(updatedLines);
  };

  const handleDrawMove = (event) => {
    if (!isDrawingRef.current) return;
    const { x, y } = getCoordinates(event);
    const point = `${x.toFixed(0)},${y.toFixed(0)}`;

    const updatedLines = [...whiteboardLinesRef.current];
    if (updatedLines.length > 0) {
      const lastLine = updatedLines[updatedLines.length - 1];
      lastLine.points = [...lastLine.points, point];
      setWhiteboardLines(updatedLines);
    }
  };

  const handleDrawEnd = () => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    sendWhiteboardData(whiteboardLinesRef.current);
  };

  const handleUndo = () => {
    if (whiteboardLines.length === 0) return;
    const undoneLine = whiteboardLines[whiteboardLines.length - 1];
    const newLines = whiteboardLines.slice(0, -1);
    setRedoStack((prev) => [...prev, undoneLine]);
    setWhiteboardLines(newLines);
    sendWhiteboardData(newLines);
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const redoneLine = redoStack[redoStack.length - 1];
    const newLines = [...whiteboardLines, redoneLine];
    setRedoStack((prev) => prev.slice(0, -1));
    setWhiteboardLines(newLines);
    sendWhiteboardData(newLines);
  };

  const handleClearWhiteboard = () => {
    setRedoStack([]);
    setWhiteboardLines([]);
    sendWhiteboardData([]);
  };

  const remoteKeys = Object.keys(remoteStreams);
  const participantCount = remoteKeys.length;



  const renderVideoView = () => (
    <View style={styles.videoContainer}>
      {participantCount === 0 ? (
        // Empty Waiting State
        <View style={styles.waitingContainer}>
          <View style={styles.waitingIconCircle}>
            <Text style={styles.waitingIconText}>👤</Text>
          </View>
          <Text style={styles.waitingTitle}>Waiting for others to join</Text>
          <Text style={styles.waitingDesc}>
            Share this unique Room ID code with participants so they can join the session.
          </Text>
          <TouchableOpacity style={styles.copyButton} onPress={copyRoomIdToClipboard}>
            <Text style={styles.copyButtonText}>Copy Room Code</Text>
          </TouchableOpacity>
        </View>
      ) : (
        // Scrollable remote video grid
        <ScrollView contentContainerStyle={styles.remoteVideoGrid}>
          {remoteKeys.map((socketId) => {
            const stream = remoteStreams[socketId];
            const peerInfo = participants.find((p) => p.socketId === socketId);
            const username = peerInfo ? peerInfo.username : 'Participant';
            
            return (
              <View
                key={socketId}
                style={[
                  styles.remoteVideoTile,
                  participantCount > 1 ? styles.gridTile : styles.fullTile,
                ]}
              >
                <Text style={styles.videoLabel}>{username}</Text>
                {stream ? (
                  <RTCView
                    streamURL={stream.toURL()}
                    style={styles.rtcStreamView}
                    objectFit="cover"
                  />
                ) : (
                  <View style={styles.videoAvatar}>
                    <Text style={styles.avatarText}>
                      {username.substring(0, 2).toUpperCase()}
                    </Text>
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* Local Video Thumbnail (Floating PiP) */}
      <View style={styles.localVideoTile}>
        <Text style={styles.localVideoLabel}>You</Text>
        {localStream && !isVideoMuted ? (
          <RTCView
            streamURL={localStream.toURL()}
            style={styles.rtcStreamView}
            objectFit="cover"
            mirror={true}
            muted={true}
          />
        ) : (
          <View style={styles.videoAvatarSmall}>
            <Text style={styles.avatarTextSmall}>Y</Text>
          </View>
        )}
      </View>
    </View>
  );

  const renderChatView = (isSidebar = false) => (
    <View style={isSidebar ? styles.chatSidebarContainer : styles.chatContainer}>
      <ScrollView
        ref={chatScrollRef}
        style={styles.chatScrollView}
        contentContainerStyle={styles.chatMessageList}
        onContentSizeChange={() => chatScrollRef.current?.scrollToEnd({ animated: true })}
      >
        {messages.length === 0 ? (
          <View style={styles.emptyChatContainer}>
            <Text style={styles.emptyChatTitle}>No messages yet</Text>
            <Text style={styles.emptyChatDesc}>Send a message or share a file to start collaborating.</Text>
          </View>
        ) : (
          messages.map((msg, index) => {
            const isMe = msg.senderId === user?.id;
            const isFile = msg.messageType === 'file';
            
            return (
              <View
                key={index}
                style={[
                  styles.messageRow,
                  isMe ? styles.myMessageRow : styles.otherMessageRow,
                ]}
              >
                {!isMe && <Text style={styles.messageSender}>{msg.username}</Text>}
                
                {isFile ? (
                  // File bubble
                  <TouchableOpacity
                    style={[
                      styles.fileBubble,
                      isMe ? styles.myFileBubble : styles.otherFileBubble,
                    ]}
                    onPress={() => handleDownloadFile(msg.fileMetadata.downloadUrl)}
                  >
                    <View style={styles.fileIconContainer}>
                      <Text style={styles.fileIcon}>📄</Text>
                    </View>
                    <View style={styles.fileMetaContainer}>
                      <Text style={styles.fileNameText} numberOfLines={1}>
                        {msg.fileMetadata.fileName}
                      </Text>
                      <Text style={styles.fileSizeText}>
                        {formatFileSize(msg.fileMetadata.fileSize)}
                      </Text>
                    </View>
                    <Text style={styles.fileDownloadText}>↓</Text>
                  </TouchableOpacity>
                ) : (
                  // Regular text message bubble
                  <View
                    style={[
                      styles.messageBubble,
                      isMe ? styles.myMessageBubble : styles.otherMessageBubble,
                    ]}
                  >
                    <Text style={styles.messageText}>{msg.content}</Text>
                    <Text style={styles.messageTime}>
                      {new Date(msg.createdAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </Text>
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Chat Input & File attachment Row */}
      <View style={styles.chatInputContainer}>
        <TouchableOpacity
          style={styles.attachmentButton}
          onPress={handlePickAndUploadFile}
          disabled={isUploading}
        >
          {isUploading ? (
            <ActivityIndicator color={COLORS.primary} size="small" />
          ) : (
            <Text style={styles.attachmentButtonText}>📎</Text>
          )}
        </TouchableOpacity>
        
        <TextInput
          style={styles.chatInput}
          placeholder="Type your message..."
          placeholderTextColor={COLORS.textMuted}
          value={messageText}
          onChangeText={setMessageText}
          multiline
          maxHeight={100}
          onKeyPress={(e) => {
            if (Platform.OS === 'web' && e.nativeEvent.key === 'Enter' && !e.nativeEvent.shiftKey) {
              e.preventDefault();
              handleSendMessage();
            }
          }}
        />
        
        <TouchableOpacity style={styles.chatSendButton} onPress={handleSendMessage}>
          <Text style={styles.chatSendButtonText}>Send</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const colorPaletteStyle = [styles.colorPalette, { flexWrap: 'wrap' }];

  const renderWhiteboardView = () => (
    <View style={styles.whiteboardContainer}>
      {/* Whiteboard Toolbar */}
      <View style={styles.whiteboardToolbar}>
        {/* Color Selections */}
        <View style={styles.toolbarRow}>
          <Text style={styles.toolbarLabel}>Color:</Text>
          <View style={colorPaletteStyle}>
            {['#1e293b', '#ef4444', '#22c55e', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899'].map((color) => (
              <TouchableOpacity
                key={color}
                style={[
                  styles.colorCircle,
                  { backgroundColor: color },
                  strokeColor === color && !isEraser && styles.selectedToolBorder,
                ]}
                onPress={() => {
                  setStrokeColor(color);
                  setIsEraser(false);
                }}
              />
            ))}
          </View>
        </View>

        {/* Tool modes: Brush thickness, Eraser, Clear */}
        <View style={styles.toolbarRow}>
          <Text style={styles.toolbarLabel}>Brush Size:</Text>
          <View style={styles.thicknessContainer}>
            {[3, 6, 12].map((size) => (
              <TouchableOpacity
                key={size}
                style={[
                  styles.thicknessButton,
                  strokeThickness === size && !isEraser && styles.activeThicknessButton,
                ]}
                onPress={() => {
                  setStrokeThickness(size);
                  setIsEraser(false);
                }}
              >
                <Text
                  style={[
                    styles.thicknessText,
                    strokeThickness === size && !isEraser && styles.activeThicknessText,
                  ]}
                >
                  {size === 3 ? 'Thin' : size === 6 ? 'Med' : 'Thick'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Eraser */}
          <TouchableOpacity
            style={[styles.eraserButton, isEraser && styles.activeEraserButton]}
            onPress={() => setIsEraser(true)}
          >
            <Text style={[styles.eraserButtonText, isEraser && styles.activeEraserText]}>
              🧽 Eraser
            </Text>
          </TouchableOpacity>

          {/* Undo/Redo Buttons */}
          <TouchableOpacity
            style={[styles.actionIconButton, whiteboardLines.length === 0 && styles.disabledButton]}
            onPress={handleUndo}
            disabled={whiteboardLines.length === 0}
          >
            <Text style={styles.actionIconText}>↩️ Undo</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionIconButton, redoStack.length === 0 && styles.disabledButton]}
            onPress={handleRedo}
            disabled={redoStack.length === 0}
          >
            <Text style={styles.actionIconText}>↪️ Redo</Text>
          </TouchableOpacity>

          {/* Clear All */}
          <TouchableOpacity style={styles.clearAllButton} onPress={handleClearWhiteboard}>
            <Text style={styles.clearAllButtonText}>🗑️ Clear All</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Drawing Canvas Container */}
      <View
        ref={canvasRef}
        style={styles.canvasContainer}
        onTouchStart={handleDrawStart}
        onTouchMove={handleDrawMove}
        onTouchEnd={handleDrawEnd}
        onMouseDown={Platform.OS === 'web' ? handleDrawStart : undefined}
        onMouseMove={Platform.OS === 'web' ? handleDrawMove : undefined}
        onMouseUp={Platform.OS === 'web' ? handleDrawEnd : undefined}
        onMouseLeave={Platform.OS === 'web' ? handleDrawEnd : undefined}
      >
        <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
          {whiteboardLines.map((line, index) => (
            <Polyline
              key={index}
              points={line.points.join(' ')}
              stroke={line.color}
              strokeWidth={line.thickness}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
        </Svg>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {isLeaving && (
        <View style={styles.leavingOverlay}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.leavingText}>Summarizing meeting with Gemini AI...</Text>
        </View>
      )}
      {/* Top Info Header */}
      <View style={styles.topBar}>
        <View style={{ width: 60 }} />

        <TouchableOpacity style={styles.roomCodeContainer} onPress={copyRoomIdToClipboard}>
          <Text style={styles.roomCodeLabel}>ROOM ID (Tap to Copy)</Text>
          <Text style={styles.roomCodeValue}>{roomId}</Text>
        </TouchableOpacity>

        <View style={styles.statusBadge}>
          <View style={styles.activeDot} />
          <Text style={styles.statusText}>
            {participantCount + 1} {participantCount === 0 ? 'User' : 'Users'}
          </Text>
        </View>
      </View>

      {/* Main Container Area */}
      <View style={styles.mainContent}>
        {isWideScreen ? (
          <View style={styles.wideContentContainer}>
            <View style={styles.mainViewContainer}>
              {activeTab === 'whiteboard' ? renderWhiteboardView() : renderVideoView()}
            </View>
            {showChatSidebar && renderChatView(true)}
          </View>
        ) : (
          <>
            {activeTab === 'video' && renderVideoView()}
            {activeTab === 'chat' && renderChatView(false)}
            {activeTab === 'whiteboard' && renderWhiteboardView()}
          </>
        )}
      </View>

      {/* Mode Navigation Bar (Mobile only) */}
      {!isWideScreen && (
        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'video' && styles.activeTabButton]}
            onPress={() => setActiveTab('video')}
          >
            <Text style={[styles.tabButtonText, activeTab === 'video' && styles.activeTabButtonText]}>
              Video ({participantCount + 1})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'chat' && styles.activeTabButton]}
            onPress={() => setActiveTab('chat')}
          >
            <Text style={[styles.tabButtonText, activeTab === 'chat' && styles.activeTabButtonText]}>
              Chat {messages.length > 0 && `(${messages.length})`}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'whiteboard' && styles.activeTabButton]}
            onPress={() => setActiveTab('whiteboard')}
          >
            <Text style={[styles.tabButtonText, activeTab === 'whiteboard' && styles.activeTabButtonText]}>
              Whiteboard
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Media Operations Bar */}
      <View style={styles.controlBar}>
        {/* Toggle Audio */}
        <TouchableOpacity
          style={[styles.circularButton, isAudioMuted && styles.circularButtonMuted]}
          onPress={toggleAudio}
        >
          <Text style={styles.controlIconText}>
            {isAudioMuted ? '🔇' : '🎙️'}
          </Text>
        </TouchableOpacity>

        {/* Toggle Video */}
        <TouchableOpacity
          style={[styles.circularButton, isVideoMuted && styles.circularButtonMuted]}
          onPress={toggleVideo}
        >
          <Text style={styles.controlIconText}>
            {isVideoMuted ? '📷' : '📹'}
          </Text>
        </TouchableOpacity>

        {/* Toggle Screen Share */}
        <TouchableOpacity
          style={[styles.circularButton, isScreenSharing && styles.circularButtonActive]}
          onPress={toggleScreenShare}
        >
          <Text style={styles.controlIconText}>🖥️</Text>
        </TouchableOpacity>

        {/* Web Sidebar Toggles */}
        {isWideScreen && (
          <>
            <TouchableOpacity
              style={[styles.circularButton, activeTab === 'whiteboard' && styles.circularButtonActive]}
              onPress={() => setActiveTab(activeTab === 'whiteboard' ? 'video' : 'whiteboard')}
            >
              <Text style={styles.controlIconText}>🎨</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.circularButton, showChatSidebar && styles.circularButtonActive]}
              onPress={() => setShowChatSidebar(!showChatSidebar)}
            >
              <Text style={styles.controlIconText}>💬</Text>
            </TouchableOpacity>
          </>
        )}

        {/* WhatsApp-Style End Call Button */}
        <TouchableOpacity
          style={styles.endCallButton}
          onPress={handleLeaveRoom}
        >
          <Text style={styles.endCallIconText}>📞</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const getStyles = (COLORS) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: COLORS.border,
  },
  leaveButton: {
    backgroundColor: COLORS.error,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  leaveButtonText: {
    color: COLORS.white,
    fontWeight: 'bold',
    fontSize: 13,
  },
  roomCodeContainer: {
    alignItems: 'center',
  },
  roomCodeLabel: {
    fontSize: 9,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  roomCodeValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceLight,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  activeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.success,
    marginRight: 6,
  },
  statusText: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '600',
  },
  mainContent: {
    flex: 1,
  },
  videoContainer: {
    flex: 1,
    position: 'relative',
    padding: 12,
  },
  waitingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  waitingIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  waitingIconText: {
    fontSize: 32,
  },
  waitingTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  waitingDesc: {
    fontSize: 13,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  copyButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  copyButtonText: {
    color: COLORS.white,
    fontWeight: 'bold',
    fontSize: 14,
  },
  remoteVideoGrid: {
    flexGrow: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingBottom: 120, // Leave padding for the local preview thumbnail
  },
  remoteVideoTile: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  fullTile: {
    width: '100%',
    height: '80%',
    minHeight: 320,
  },
  gridTile: {
    width: (width - 36) / 2, // Split view in a grid
    height: 220,
  },
  rtcStreamView: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  videoLabel: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    color: COLORS.text,
    fontSize: 11,
    fontWeight: '600',
    zIndex: 10,
  },
  videoAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: COLORS.white,
    fontSize: 24,
    fontWeight: 'bold',
  },
  localVideoTile: {
    width: 110,
    height: 160,
    position: 'absolute',
    bottom: 16,
    right: 16,
    backgroundColor: COLORS.surfaceLight,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    elevation: 5,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    zIndex: 20,
  },
  localVideoLabel: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    color: COLORS.text,
    fontSize: 9,
    fontWeight: '600',
    zIndex: 10,
  },
  videoAvatarSmall: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.secondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarTextSmall: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
  chatContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  chatScrollView: {
    flex: 1,
  },
  chatMessageList: {
    padding: 16,
    paddingBottom: 24,
  },
  emptyChatContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 100,
  },
  emptyChatTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 4,
  },
  emptyChatDesc: {
    fontSize: 13,
    color: COLORS.textMuted,
    textAlign: 'center',
  },
  messageRow: {
    marginVertical: 6,
    maxWidth: '80%',
  },
  myMessageRow: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
  },
  otherMessageRow: {
    alignSelf: 'flex-start',
    alignItems: 'flex-start',
  },
  messageSender: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginBottom: 2,
    marginLeft: 4,
  },
  messageBubble: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  myMessageBubble: {
    backgroundColor: COLORS.primary,
    borderBottomRightRadius: 4,
  },
  otherMessageBubble: {
    backgroundColor: COLORS.surface,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  messageText: {
    color: COLORS.white,
    fontSize: 14,
    lineHeight: 18,
  },
  messageTime: {
    fontSize: 8,
    color: COLORS.textMuted,
    alignSelf: 'flex-end',
    marginTop: 4,
  },
  fileBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    padding: 12,
    width: 250,
  },
  myFileBubble: {
    backgroundColor: COLORS.primary,
    borderBottomRightRadius: 4,
  },
  otherFileBubble: {
    backgroundColor: COLORS.surface,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  fileIconContainer: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  fileIcon: {
    fontSize: 20,
  },
  fileMetaContainer: {
    flex: 1,
    marginRight: 8,
  },
  fileNameText: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: 'bold',
  },
  fileSizeText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 10,
    marginTop: 2,
  },
  fileDownloadText: {
    color: COLORS.white,
    fontSize: 20,
    fontWeight: 'bold',
  },
  chatInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderTopWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  attachmentButton: {
    paddingHorizontal: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
  },
  attachmentButtonText: {
    fontSize: 22,
    color: COLORS.primary,
  },
  chatInput: {
    flex: 1,
    backgroundColor: COLORS.surfaceLight,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    color: COLORS.text,
    fontSize: 14,
    marginRight: 12,
  },
  chatSendButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chatSendButtonText: {
    color: COLORS.white,
    fontWeight: 'bold',
    fontSize: 13,
  },
  whiteboardContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    padding: 12,
    gap: 12,
  },
  whiteboardToolbar: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 12,
  },
  toolbarRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  toolbarLabel: {
    fontSize: 12,
    color: COLORS.textMuted,
    fontWeight: '600',
    width: 80,
  },
  colorPalette: {
    flexDirection: 'row',
    gap: 10,
  },
  colorCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  selectedToolBorder: {
    borderColor: COLORS.primary,
    borderWidth: 2.5,
  },
  thicknessContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  thicknessButton: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: COLORS.surfaceLight,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  activeThicknessButton: {
    borderColor: COLORS.primary,
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
  },
  thicknessText: {
    color: COLORS.text,
    fontSize: 11,
    fontWeight: '600',
  },
  activeThicknessText: {
    color: COLORS.primary,
  },
  eraserButton: {
    marginLeft: 'auto',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: COLORS.surfaceLight,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  activeEraserButton: {
    borderColor: COLORS.warning,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
  },
  eraserButtonText: {
    color: COLORS.text,
    fontSize: 11,
    fontWeight: '600',
  },
  activeEraserText: {
    color: COLORS.warning,
  },
  clearAllButton: {
    marginLeft: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.error,
    backgroundColor: 'rgba(239, 108, 108, 0.05)',
  },
  clearAllButtonText: {
    color: COLORS.error,
    fontSize: 11,
    fontWeight: 'bold',
  },
  canvasContainer: {
    flex: 1,
    backgroundColor: '#ffffff', // Real whiteboard color
    borderRadius: 12,
    borderWidth: 6,
    borderColor: '#94a3b8', // Silver frame border
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
    touchAction: 'none',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    paddingVertical: 8,
    paddingHorizontal: 16,
    justifyContent: 'space-around',
    borderTopWidth: 1,
    borderColor: COLORS.border,
  },
  tabButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 16,
  },
  activeTabButton: {
    backgroundColor: COLORS.primary,
  },
  tabButtonText: {
    color: COLORS.textMuted,
    fontWeight: '600',
    fontSize: 13,
  },
  activeTabButtonText: {
    color: COLORS.white,
  },
  tabPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  tabPlaceholderTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 8,
  },
  tabPlaceholderDesc: {
    fontSize: 14,
    color: COLORS.textMuted,
    textAlign: 'center',
  },
  controlBar: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderColor: COLORS.border,
  },
  circularButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORS.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  circularButtonActive: {
    borderColor: COLORS.success,
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
  },
  circularButtonMuted: {
    borderColor: COLORS.error,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
  },
  endCallButton: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: COLORS.error,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 4,
  },
  controlIconText: {
    fontSize: 20,
  },
  endCallIconText: {
    fontSize: 22,
    color: COLORS.white,
    transform: [{ rotate: '135deg' }],
  },
  leavingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },
  leavingText: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 16,
  },
  chatSidebarContainer: {
    width: 340,
    height: '100%',
    backgroundColor: COLORS.surface,
    borderLeftWidth: 1,
    borderColor: COLORS.border,
  },
  actionIconButton: {
    marginLeft: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surfaceLight,
  },
  actionIconText: {
    color: COLORS.text,
    fontSize: 11,
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.5,
  },
  wideContentContainer: {
    flex: 1,
    flexDirection: 'row',
  },
  mainViewContainer: {
    flex: 1,
  },
});
