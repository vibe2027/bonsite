/**
 * PHASE 6.0 — Real-Time Collaboration Engine (OT - Operational Transform)
 * Enables collaborative document editing with conflict resolution
 */

const { createClient } = require('@supabase/supabase-js');

class OperationalTransformEngine {
  constructor(supabaseUrl, supabaseKey) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.operations = [];
    this.transformMap = new Map();
  }

  /**
   * Apply an operation to a document
   * @param {string} documentId - Document identifier
   * @param {Object} operation - {type: 'insert'|'delete', position: num, content: string}
   * @returns {Promise<Object>} - Transformed operation result
   */
  async applyOperation(documentId, operation) {
    try {
      // Get current document state
      const { data: doc } = await this.supabase
        .from('collaborative_documents')
        .select('content, version, operations')
        .eq('id', documentId)
        .single();

      if (!doc) throw new Error('Document not found');

      // Transform operation against previous operations
      const transformedOp = this.transformAgainstHistory(
        operation,
        doc.operations || []
      );

      // Apply to document content
      const newContent = this.applyToContent(doc.content, transformedOp);

      // Store operation
      await this.supabase
        .from('collaborative_operations')
        .insert({
          document_id: documentId,
          operation: transformedOp,
          timestamp: new Date().toISOString(),
          version: doc.version + 1
        });

      // Update document
      await this.supabase
        .from('collaborative_documents')
        .update({
          content: newContent,
          version: doc.version + 1,
          updated_at: new Date().toISOString()
        })
        .eq('id', documentId);

      return { success: true, operation: transformedOp, newContent };
    } catch (error) {
      console.error('Operation error:', error);
      throw error;
    }
  }

  /**
   * Transform operation against history to resolve conflicts
   */
  transformAgainstHistory(operation, history) {
    let transformed = { ...operation };

    for (const prevOp of history) {
      transformed = this.transform(transformed, prevOp);
    }

    return transformed;
  }

  /**
   * OT transform function - resolve conflicts between two operations
   * @param {Object} op1 - Client operation
   * @param {Object} op2 - Server operation
   * @returns {Object} - Transformed operation
   */
  transform(op1, op2) {
    // If operations at different positions, no conflict
    if (op1.position !== op2.position) {
      // Adjust position if needed
      if (op1.type === 'insert' && op2.type === 'insert') {
        if (op1.position > op2.position) {
          return { ...op1, position: op1.position + op2.content.length };
        }
      }
      if (op1.type === 'insert' && op2.type === 'delete') {
        if (op1.position > op2.position) {
          return { ...op1, position: op1.position - op2.length };
        }
      }
      return op1;
    }

    // Same position - apply precedence rules
    if (op1.type === 'insert' && op2.type === 'insert') {
      // Insert after conflicting insert (client-first)
      return { ...op1, position: op1.position + op2.content.length };
    }

    if (op1.type === 'delete' && op2.type === 'insert') {
      // Delete before insert, keep position
      return op1;
    }

    if (op1.type === 'insert' && op2.type === 'delete') {
      // Insert after delete
      return { ...op1, position: op1.position - op2.length };
    }

    return op1;
  }

  /**
   * Apply operation to document content
   */
  applyToContent(content, operation) {
    switch (operation.type) {
      case 'insert':
        return (
          content.slice(0, operation.position) +
          operation.content +
          content.slice(operation.position)
        );
      case 'delete':
        return (
          content.slice(0, operation.position) +
          content.slice(operation.position + operation.length)
        );
      default:
        return content;
    }
  }

  /**
   * Subscribe to real-time updates via Supabase Realtime
   */
  subscribeToDocument(documentId, onUpdate) {
    const subscription = this.supabase
      .from(`collaborative_operations:document_id=eq.${documentId}`)
      .on('*', (payload) => {
        onUpdate(payload.new);
      })
      .subscribe();

    return subscription;
  }

  /**
   * Get document edit history
   */
  async getHistory(documentId, limit = 100) {
    const { data } = await this.supabase
      .from('collaborative_operations')
      .select('*')
      .eq('document_id', documentId)
      .order('version', { ascending: true })
      .limit(limit);

    return data;
  }
}

module.exports = OperationalTransformEngine;
