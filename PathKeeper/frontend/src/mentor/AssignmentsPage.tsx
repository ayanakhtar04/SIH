import React, { useState } from 'react';
import { Box, Paper, Typography, Stack, FormControl, InputLabel, Select, MenuItem, Table, TableHead, TableRow, TableCell, TableBody, Chip, Button, IconButton } from '@mui/material';
import FilterListIcon from '@mui/icons-material/FilterList';
import AddIcon from '@mui/icons-material/Add';

// Mock data for filters
const DEPARTMENTS = ['CSE', 'ECE', 'ME', 'CE', 'EE'];
const PROGRAMS = ['B.Tech', 'M.Tech', 'BCA', 'MCA'];
const YEARS = ['1', '2', '3', '4'];
const SEMESTERS = ['1', '2', '3', '4', '5', '6', '7', '8'];
const SECTIONS = ['A', 'B', 'C', 'D'];

// Mock data for assignments
const MOCK_ASSIGNMENTS = [
  { id: 1, title: 'Data Structures Lab 1', department: 'CSE', program: 'B.Tech', year: '2', semester: '3', section: 'A', dueDate: '2023-10-15', status: 'Active', submissions: 45, total: 60 },
  { id: 2, title: 'Circuit Theory Quiz', department: 'ECE', program: 'B.Tech', year: '2', semester: '3', section: 'B', dueDate: '2023-10-18', status: 'Active', submissions: 50, total: 58 },
  { id: 3, title: 'Thermodynamics Project', department: 'ME', program: 'B.Tech', year: '3', semester: '5', section: 'A', dueDate: '2023-11-01', status: 'Upcoming', submissions: 0, total: 55 },
  { id: 4, title: 'Algorithms Assignment 2', department: 'CSE', program: 'B.Tech', year: '2', semester: '3', section: 'A', dueDate: '2023-10-10', status: 'Closed', submissions: 58, total: 60 },
];

const AssignmentsPage: React.FC = () => {
  const [filters, setFilters] = useState({
    department: 'All',
    program: 'All',
    year: 'All',
    semester: 'All',
    section: 'All',
  });

  const handleFilterChange = (field: string, value: string) => {
    setFilters(prev => ({ ...prev, [field]: value }));
  };

  const filteredAssignments = MOCK_ASSIGNMENTS.filter(assignment => {
    if (filters.department !== 'All' && assignment.department !== filters.department) return false;
    if (filters.program !== 'All' && assignment.program !== filters.program) return false;
    if (filters.year !== 'All' && assignment.year !== filters.year) return false;
    if (filters.semester !== 'All' && assignment.semester !== filters.semester) return false;
    if (filters.section !== 'All' && assignment.section !== filters.section) return false;
    return true;
  });

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="h4" fontWeight={700}>Assignments</Typography>
        <Button variant="contained" startIcon={<AddIcon />}>Create Assignment</Button>
      </Stack>

      <Paper elevation={0} sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="center">
          <FilterListIcon color="action" />
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Department</InputLabel>
            <Select
              value={filters.department}
              label="Department"
              onChange={(e) => handleFilterChange('department', e.target.value)}
            >
              <MenuItem value="All">All</MenuItem>
              {DEPARTMENTS.map(d => <MenuItem key={d} value={d}>{d}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Program</InputLabel>
            <Select
              value={filters.program}
              label="Program"
              onChange={(e) => handleFilterChange('program', e.target.value)}
            >
              <MenuItem value="All">All</MenuItem>
              {PROGRAMS.map(p => <MenuItem key={p} value={p}>{p}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 100 }}>
            <InputLabel>Year</InputLabel>
            <Select
              value={filters.year}
              label="Year"
              onChange={(e) => handleFilterChange('year', e.target.value)}
            >
              <MenuItem value="All">All</MenuItem>
              {YEARS.map(y => <MenuItem key={y} value={y}>{y}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 100 }}>
            <InputLabel>Semester</InputLabel>
            <Select
              value={filters.semester}
              label="Semester"
              onChange={(e) => handleFilterChange('semester', e.target.value)}
            >
              <MenuItem value="All">All</MenuItem>
              {SEMESTERS.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 100 }}>
            <InputLabel>Section</InputLabel>
            <Select
              value={filters.section}
              label="Section"
              onChange={(e) => handleFilterChange('section', e.target.value)}
            >
              <MenuItem value="All">All</MenuItem>
              {SECTIONS.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
            </Select>
          </FormControl>
          <Button variant="text" onClick={() => setFilters({ department: 'All', program: 'All', year: 'All', semester: 'All', section: 'All' })}>
            Reset
          </Button>
        </Stack>
      </Paper>

      <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
        <Table>
          <TableHead>
            <TableRow sx={{ bgcolor: 'action.hover' }}>
              <TableCell>Title</TableCell>
              <TableCell>Target Audience</TableCell>
              <TableCell>Due Date</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Submissions</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredAssignments.map((assignment) => (
              <TableRow key={assignment.id} hover>
                <TableCell>
                  <Typography variant="subtitle2">{assignment.title}</Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="caption" display="block">
                    {assignment.department} - {assignment.program}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Yr: {assignment.year} | Sem: {assignment.semester} | Sec: {assignment.section}
                  </Typography>
                </TableCell>
                <TableCell>{assignment.dueDate}</TableCell>
                <TableCell>
                  <Chip 
                    label={assignment.status} 
                    size="small" 
                    color={assignment.status === 'Active' ? 'success' : assignment.status === 'Upcoming' ? 'info' : 'default'} 
                    variant="outlined" 
                  />
                </TableCell>
                <TableCell>
                  {assignment.submissions} / {assignment.total}
                </TableCell>
                <TableCell align="right">
                  <Button size="small">View</Button>
                </TableCell>
              </TableRow>
            ))}
            {filteredAssignments.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 3 }}>
                  <Typography variant="body2" color="text.secondary">No assignments found matching filters.</Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>
    </Box>
  );
};

export default AssignmentsPage;
