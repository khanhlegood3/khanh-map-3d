// src/components/Hero3DMap/initMap.tsx
import { GoogleGenAI, mcpToTool } from '@google/genai';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { ChatState, MapApp, marked } from './map_app'; 
import { startMcpGoogleMapServer } from './mcp_maps_server';

// ... (Giữ nguyên các hằng số SYSTEM_INSTRUCTIONS, hàm camelCaseToDash, cấu hình ai...)

export async function initHero3DMap(containerElement) {
  // Tránh khởi tạo nhiều lần khi React re-render
  if (containerElement.hasChildNodes()) return;

  const mapApp = new MapApp();
  containerElement.appendChild(mapApp);

  const [transportA, transportB] = InMemoryTransport.createLinkedPair();
  void startMcpGoogleMapServer(
    transportA,
    (params) => {
      mapApp.handleMapQuery(params);
    }
  );

  const mcpClient = await startClient(transportB);
  const aiChat = createAiChat(mcpClient);

  // Copy toàn bộ logic của hàm mapApp.sendMessageHandler từ file index.tsx cũ vào đây
  mapApp.sendMessageHandler = async (input, role) => {
     // ... nội dung từ file index.tsx ...
  };
}