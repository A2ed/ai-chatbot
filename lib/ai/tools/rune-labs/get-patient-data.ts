import { tool } from 'ai';
import { z } from 'zod';

const PYTHON_SERVER_URL = process.env.PYTHON_SERVER_URL || 'http://localhost:8000';

export interface PatientData {
    time: string;
    measurement: string;
    severity: string;
    percentage: number;
    measurement_duration_ns: number;
    device_id: string;
}

export interface PatientDataParams {
    patient_id: string;
    selected_date: string;
    measurement_type: 'tremor' | 'dyskinesia';
    repull_all?: boolean;
    severity?: 'all' | 'slight' | 'mild' | 'moderate' | 'strong' | 'none' | 'unknown';
}

export const getPatientData = tool({
    description: 'Fetch tremor or dyskinesia measurement data for a patient from Rune Labs API',
    parameters: z.object({
        patient_id: z.string().describe('The patient identifier'),
        selected_date: z.string().describe('The end date for the data window (ISO format)'),
        measurement_type: z.enum(['tremor', 'dyskinesia']).describe('Type of measurement to return'),
        repull_all: z.boolean().optional().describe('If true, ignore cache and fetch fresh data'),
        severity: z.enum(['all', 'slight', 'mild', 'moderate', 'strong', 'none', 'unknown'])
            .optional()
            .default('all')
            .describe('Filter data by severity level')
    }),
    execute: async (params: PatientDataParams) => {
        try {
            const response = await fetch(`${PYTHON_SERVER_URL}/api/patient-data`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(params)
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(`Failed to fetch patient data: ${error.detail || 'Unknown error'}`);
            }

            const data = await response.json();
            return data as { data: PatientData[] };
        } catch (error) {
            throw new Error(`Error fetching patient data: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
}); 