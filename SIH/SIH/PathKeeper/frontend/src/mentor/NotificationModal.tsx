import React, { useState, useEffect } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, FormControl, InputLabel, Select, MenuItem, Stack, Typography, CircularProgress, IconButton, Tooltip } from '@mui/material';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import { sendNotification, fetchDraft } from './notifyApi';

interface Props {
  open: boolean;
  onClose: () => void;
  token: string;
  studentIds?: string[]; // if present used as primary recipients (by id -> lookup server side)
  presetBody?: string;
  singleStudentName?: string;
}

const NotificationModal: React.FC<Props> = ({ open, onClose, token, studentIds, presetBody, singleStudentName }) => {
  const [channel, setChannel] = useState<'email'|'sms'>('email');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState(presetBody || '');
  const [manualRecipients, setManualRecipients] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string|undefined>();
  const [success, setSuccess] = useState<string|undefined>();
  const [draftLoading, setDraftLoading] = useState(false);

  useEffect(()=> { if (open) { setError(undefined); setSuccess(undefined); } }, [open]);
  useEffect(()=> { if (presetBody) setBody(presetBody); }, [presetBody]);

  const resolvedRecipientsHint = () => {
    if (studentIds?.length) return `${studentIds.length} student${studentIds.length>1?'s':''} selected`;
    if (manualRecipients.trim()) return manualRecipients.split(/[,\n;]/).map(r=> r.trim()).filter(Boolean).length + ' manual';
    return 'No recipients yet';
  };

  const handleSend = async () => {
    setSending(true); setError(undefined); setSuccess(undefined);
    try {
      const recipients = manualRecipients.split(/[,\n;]/).map(r=> r.trim()).filter(Boolean);
      if ((!studentIds || studentIds.length===0) && recipients.length===0) {
        setError('Add at least one recipient.'); setSending(false); return;
      }
      if (!body.trim()) { setError('Message body required.'); setSending(false); return; }
      const payload: any = { channel, body: body.trim() };
      if (channel==='email' && subject.trim()) payload.subject = subject.trim();
      if (studentIds && studentIds.length) payload.studentIds = studentIds;
      if (recipients.length) payload.recipients = recipients;
      const resp = await sendNotification(token, payload);
      setSuccess(`Sent ${resp.count} notification${resp.count>1?'s':''}`);
      setTimeout(()=> { onClose(); }, 900);
    } catch(e:any) {
      setError(e.message || 'Send failed');
    } finally { setSending(false); }
  };

  const handleDraft = async () => {
    setDraftLoading(true); setError(undefined);
    try {
      const sid = studentIds && studentIds.length === 1 ? studentIds[0] : undefined;
      const draft = await fetchDraft(token, { studentId: sid, contextType: 'outreach', tone: 'supportive' });
      if (draft?.draft) {
        // Append if body already present
        setBody(prev => prev ? prev + '\n\n' + draft.draft : draft.draft);
      }
    } catch (e:any) {
      setError(e.message || 'Draft failed');
    } finally { setDraftLoading(false); }
  };

  return (
    <Dialog open={open} onClose={()=> !sending && onClose()} fullWidth maxWidth="sm">
      <DialogTitle>Send Notification{singleStudentName? `: ${singleStudentName}`: ''}</DialogTitle>
      <DialogContent dividers sx={{ display:'flex', flexDirection:'column', gap:2 }}>
        <Stack direction={{ xs:'column', sm:'row' }} spacing={1} alignItems={{ sm:'center' }}>
          <FormControl size="small" sx={{ minWidth:120 }} disabled={sending}>
            <InputLabel>Channel</InputLabel>
            <Select label="Channel" value={channel} onChange={e=> setChannel(e.target.value as any)}>
              <MenuItem value="email">Email</MenuItem>
              <MenuItem value="sms">SMS</MenuItem>
            </Select>
          </FormControl>
          <Typography variant="caption" color="text.secondary">{resolvedRecipientsHint()}</Typography>
          <Tooltip title="AI Suggestion" placement="top" arrow>
            <span>
              <IconButton size="small" onClick={handleDraft} disabled={draftLoading || sending}>
                {draftLoading? <CircularProgress size={18} /> : <AutoFixHighIcon fontSize="small" />}
              </IconButton>
            </span>
          </Tooltip>
        </Stack>
        {channel==='email' && <TextField label="Subject" size="small" value={subject} onChange={e=> setSubject(e.target.value)} disabled={sending} fullWidth />}
        {!studentIds?.length && (
          <TextField label="Manual Recipients" size="small" value={manualRecipients} onChange={e=> setManualRecipients(e.target.value)} placeholder="one@example.com, two@example.com" multiline minRows={2} disabled={sending} />
        )}
        <TextField label="Message" value={body} onChange={e=> setBody(e.target.value)} multiline minRows={6} disabled={sending} placeholder="Write your message or use AI suggestion..." />
        {error && <Typography variant="caption" color="error">{error}</Typography>}
        {success && <Typography variant="caption" color="success.main">{success}</Typography>}
      </DialogContent>
      <DialogActions>
        <Button onClick={()=> !sending && onClose()} disabled={sending}>Cancel</Button>
        <Button onClick={handleSend} variant="contained" disabled={sending}>{sending? 'Sending...':'Send'}</Button>
      </DialogActions>
    </Dialog>
  );
};

export default NotificationModal;
