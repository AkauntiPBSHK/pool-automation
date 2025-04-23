# tools/simulation_control.py
"""
Command-line tool for controlling the simulation environment.
"""
import argparse
import json
import sys
import os
import time
import random
import logging

# Add parent directory to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# Import simulation environment
from hardware.simulation import SimulationEnvironment

def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(description='Pool Automation Simulation Control')
    
    # Commands
    subparsers = parser.add_subparsers(dest='command', help='Command to execute')
    
    # Start command
    start_parser = subparsers.add_parser('start', help='Start the simulation')
    
    # Stop command
    stop_parser = subparsers.add_parser('stop', help='Stop the simulation')
    
    # Set parameter command
    set_parser = subparsers.add_parser('set', help='Set a parameter value')
    set_parser.add_argument('parameter', help='Parameter name')
    set_parser.add_argument('value', help='Parameter value')
    
    # Get parameter command
    get_parser = subparsers.add_parser('get', help='Get a parameter value')
    get_parser.add_argument('parameter', help='Parameter name')
    
    # Event command
    event_parser = subparsers.add_parser('event', help='Trigger a simulated event')
    event_parser.add_argument('event_type', choices=['swimmer_load', 'rainwater', 'leaves', 'fault'], 
                             help='Event type')
    
    # Dosing command
    dosing_parser = subparsers.add_parser('dose', help='Simulate a dosing event')
    dosing_parser.add_argument('pump_type', choices=['acid', 'chlorine', 'pac'], help='Pump type')
    dosing_parser.add_argument('duration', type=int, help='Duration in seconds')
    dosing_parser.add_argument('--flow_rate', type=float, help='Flow rate in ml/h (for PAC)')
    
    # Export command
    export_parser = subparsers.add_parser('export', help='Export simulation history')
    export_parser.add_argument('--hours', type=int, default=24, help='Hours of history to export')
    export_parser.add_argument('--output', default='simulation_history.json', help='Output file name')
    
    # Parse arguments
    args = parser.parse_args()
    
    # Create simulation environment
    sim = SimulationEnvironment()
    
    if args.command == 'start':
        sim.start()
        print("Simulation started")
        
    elif args.command == 'stop':
        sim.stop()
        print("Simulation stopped")
        
    elif args.command == 'set':
        # Convert value to appropriate type
        try:
            value = float(args.value)
        except ValueError:
            if args.value.lower() == 'true':
                value = True
            elif args.value.lower() == 'false':
                value = False
            else:
                value = args.value
        
        # Set parameter
        if args.parameter in sim.parameters:
            sim.parameters[args.parameter] = value
            print(f"Set {args.parameter} = {value}")
        else:
            print(f"Unknown parameter: {args.parameter}")
        
    elif args.command == 'get':
        if args.parameter in sim.parameters:
            print(f"{args.parameter} = {sim.parameters[args.parameter]}")
        else:
            print(f"Unknown parameter: {args.parameter}")
        
    elif args.command == 'event':
        # Trigger event
        if args.event_type == 'swimmer_load':
            sim.parameters['turbidity'] += 0.05
            sim.parameters['free_cl'] -= 0.2
            sim.parameters['comb_cl'] += 0.1
            sim.parameters['ph'] += 0.1
            print("Simulated swimmer load event")
            
        elif args.event_type == 'rainwater':
            sim.parameters['ph'] -= 0.2
            sim.parameters['temperature'] -= 0.5
            sim.parameters['turbidity'] += 0.03
            print("Simulated rainwater event")
            
        elif args.event_type == 'leaves':
            sim.parameters['turbidity'] += 0.1
            sim.parameters['free_cl'] -= 0.1
            print("Simulated leaves in pool event")
            
        elif args.event_type == 'fault':
            fault_types = ['ph_spike', 'orp_dropout', 'chlorine_drift']
            fault = random.choice(fault_types)
            
            if fault == 'ph_spike':
                sim.parameters['ph'] += 1.0
                print("Simulated pH sensor spike fault")
                
            elif fault == 'orp_dropout':
                sim.parameters['orp'] = 0
                print("Simulated ORP sensor dropout fault")
                
            elif fault == 'chlorine_drift':
                sim.parameters['free_cl'] *= 2.5
                print("Simulated chlorine sensor drift fault")
        
    elif args.command == 'dose':
        # Simulate dosing
        flow_rate = args.flow_rate if args.flow_rate is not None else 75
        sim.simulate_dosing(args.pump_type, args.duration, flow_rate)
        print(f"Simulated {args.pump_type} dosing for {args.duration}s at {flow_rate} ml/h")
        
    elif args.command == 'export':
        # Export history
        history = {}
        for param in sim.parameters:
            if not param.endswith('_active'):
                history[param] = sim.get_history(param, args.hours)
                # Convert timestamps to strings for JSON
                history[param] = [(ts.isoformat(), val) for ts, val in history[param]]
        
        # Add dosing events
        history['dosing_events'] = sim.get_dosing_events(hours=args.hours)
        for event in history['dosing_events']:
            event['timestamp'] = event['timestamp'].isoformat()
        
        with open(args.output, 'w') as f:
            json.dump(history, f, indent=4)
        
        print(f"Exported {args.hours} hours of history to {args.output}")
    
    else:
        parser.print_help()

if __name__ == '__main__':
    main()