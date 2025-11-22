import React, { useState, useEffect } from 'react';
import { Box, Button, Typography, Paper, TextField, Stack, Divider, Alert, LinearProgress, ToggleButtonGroup, ToggleButton, Chip } from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import DownloadIcon from '@mui/icons-material/Download';
import SendIcon from '@mui/icons-material/Send';
import DataObjectIcon from '@mui/icons-material/DataObject';
import { fetchImportTemplate, importStudentsRaw, importStudentsFile } from '../api';

interface TemplateInfo { sampleCsv: string; columns: { name: string; required: boolean; notes?: string }[]; filenameSuggestion: string; rateLimit: any; transaction: boolean; }

const StudentImport: React.FC = () => {
  const [template, setTemplate] = useState<TemplateInfo | null>(null);
  const [csvText, setCsvText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<'raw'|'file'>('raw');
  const [dryRun, setDryRun] = useState(true);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [hovering, setHovering] = useState(false);
  const [previewLines, setPreviewLines] = useState<string[]>([]);
  const [advMode, setAdvMode] = useState<'basic'|'advanced'>('basic');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchImportTemplate().then(setTemplate).catch(()=>{/* ignore */});
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) { setFile(f); genPreview(f); }
  };

  async function genPreview(f: File) {
    try {
      const text = await f.text();
      setPreviewLines(text.split(/\r?\n/).slice(0,6));
    } catch { setPreviewLines([]); }
  }

  const onDrop = (ev: React.DragEvent) => {
    ev.preventDefault(); ev.stopPropagation(); setHovering(false);
    const f = ev.dataTransfer.files && ev.dataTransfer.files[0];
    if (f && /\.csv$/i.test(f.name)) { setFile(f); genPreview(f); }
  };
  const onDrag = (ev: React.DragEvent) => { ev.preventDefault(); ev.stopPropagation(); if (ev.type==='dragenter' || ev.type==='dragover') setHovering(true); else if (ev.type==='dragleave') setHovering(false); };

  async function doImport() {
    if (loading) return;
    setError(null); setResult(null); setLoading(true);
    try {
      let data;
      if (mode === 'raw') {
        data = await importStudentsRaw(csvText, { dryRun });
      } else if (file) {
        data = await importStudentsFile(file, { dryRun });
      } else {
        throw new Error('No file selected');
      }
      setResult(data);
    } catch (e: any) {
      setError(e.message || 'Import failed');
    } finally {
      setLoading(false);
    }
  }

  function loadSample() {
    if (template?.sampleCsv) {
      setCsvText(template.sampleCsv + '\n');
    }
  }

  return (
    <Box sx={{ p: 3, maxWidth: 1200, mx: 'auto', display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Stack direction="row" alignItems="center" spacing={2} flexWrap="wrap">
        <Typography variant="h4" fontWeight={600}>Student Import</Typography>
        <ToggleButtonGroup size="small" exclusive value={advMode} onChange={(_,v)=> v && setAdvMode(v)}>
          <ToggleButton value="basic">Basic</ToggleButton>
          <ToggleButton value="advanced">Advanced</ToggleButton>
        </ToggleButtonGroup>
        {advMode==='advanced' && <Chip size="small" color="primary" label="Drag & Drop" />}
      </Stack>
      <Typography variant="body1" color="text.secondary">Bulk add students using CSV. Start with a dry run to validate before committing. Advanced mode provides drag & drop plus preview.</Typography>

      <Paper sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <ToggleButtonGroup exclusive size="small" value={mode} onChange={(_,v)=> v && setMode(v)}>
            <ToggleButton value="raw">Raw Text</ToggleButton>
            <ToggleButton value="file">File Upload</ToggleButton>
          </ToggleButtonGroup>
          <ToggleButtonGroup exclusive size="small" value={dryRun? 'dry':'real'} onChange={(_,v)=> v && setDryRun(v==='dry')}>
            <ToggleButton value="dry">Dry Run</ToggleButton>
            <ToggleButton value="real">Commit</ToggleButton>
          </ToggleButtonGroup>
          <Button size="small" variant="outlined" startIcon={<DownloadIcon />} onClick={loadSample} disabled={!template}>Sample</Button>
          {template && <Button size="small" variant="text" startIcon={<DataObjectIcon />} onClick={()=>setCsvText(t=>t || template.sampleCsv + '\n')}>Fill Blank</Button>}
        </Stack>

        {advMode==='advanced' && mode==='file' && (
          <Box onDrop={onDrop} onDragEnter={onDrag} onDragOver={onDrag} onDragLeave={onDrag} sx={{ border:'2px dashed', borderColor: hovering? 'primary.main':'divider', p:4, textAlign:'center', borderRadius:3, bgcolor: hovering? 'action.hover':'transparent', transition:'all .15s' }}>
            <Typography variant="subtitle1" fontWeight={600}>{hovering? 'Release to upload':'Drag & drop CSV here'}</Typography>
            <Typography variant="caption" color="text.secondary">Max ~5MB • .csv only</Typography>
            <Box mt={2}>
              <Button variant="outlined" component="label" size="small">Browse<input hidden type="file" accept=".csv,text/csv" onChange={handleFileChange} /></Button>
            </Box>
            {file && <Typography variant="caption" display="block" mt={1}>{file.name}</Typography>}
            {previewLines.length>0 && <Box mt={2} sx={{ textAlign:'left', fontFamily:'monospace', fontSize:12, maxHeight:120, overflow:'auto', p:1, border:'1px solid', borderColor:'divider', borderRadius:1 }}>
              {previewLines.map((l,i)=>(<Typography key={i} variant="caption" component="pre" sx={{ m:0 }}>{l}</Typography>))}
            </Box>}
          </Box>
        )}
        {mode === 'raw' ? (
          <TextField
            label="CSV Text"
            value={csvText}
            onChange={e=>setCsvText(e.target.value)}
            placeholder="studentCode,name,email,program,year,riskScore"
            multiline minRows={8}
            fullWidth
          />
        ) : (
          advMode==='basic' && (
            <Box>
              <Button variant="contained" component="label" startIcon={<CloudUploadIcon />}>Choose CSV<input hidden type="file" accept=".csv,text/csv" onChange={handleFileChange} /></Button>
              {file && <Typography variant="caption" sx={{ ml: 1 }}>{file.name}</Typography>}
            </Box>
          )
        )}

        <Stack direction="row" spacing={2}>
          <Button variant="contained" startIcon={<SendIcon />} disabled={loading || (mode==='raw' ? !csvText.trim() : !file)} onClick={doImport}>{loading ? 'Importing...' : dryRun ? 'Validate CSV' : 'Import Now' }</Button>
          {loading && <LinearProgress sx={{ flex: 1, alignSelf: 'center' }} />}
        </Stack>

        {error && <Alert severity="error">{error}</Alert>}
        {result && (
          <Alert severity={result.ok ? (result.dryRun ? 'info':'success') : 'warning'} sx={{ whiteSpace: 'pre-wrap' }}>
            <Typography variant="subtitle2" gutterBottom>Result</Typography>
            <Typography variant="body2">Mode: {result.dryRun ? 'Dry Run':'Committed'}</Typography>
            <Typography variant="body2">Counts: total={result.counts.total} valid={result.counts.valid} created={result.counts.created} skipped={result.counts.skipped} errors={result.counts.errors}</Typography>
            {result.errors?.length > 0 && <Box component="ul" sx={{ pl: 3, mb: 0 }}>
              {result.errors.map((er: any, i: number)=>(<li key={i}><Typography variant="caption">Line {er.line}: {er.error}</Typography></li>))}
            </Box>}
          </Alert>
        )}
      </Paper>

      {template && (
        <Paper sx={{ p:2, display:'flex', flexDirection:'column', gap:1 }}>
          <Typography variant="h6">Template Columns</Typography>
          <Divider />
          <Box component="ul" sx={{ columns: { xs:1, sm:2, md:3 }, m:0, pl:3 }}>
            {template.columns.map(col => (
              <li key={col.name}>
                <Typography variant="body2"><strong>{col.name}</strong>{col.required ? ' *' : ''}{col.notes ? ` — ${col.notes}`:''}</Typography>
              </li>
            ))}
          </Box>
          <Typography variant="caption" color="text.secondary">Rate Limit: {template.rateLimit.maxImportsPerWindow} imports / {template.rateLimit.windowMinutes} min. Transaction rollback: {template.transaction ? 'Enabled':'Disabled'}.</Typography>
        </Paper>
      )}
    </Box>
  );
};

export default StudentImport;
